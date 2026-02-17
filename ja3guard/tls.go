package main

import (
	"bytes"
	"encoding/binary"
	"io"
	"log"
	"net"
	"sync"
)

// ja3Conn 包装原始 TCP 连接，在已读取的 ClientHello 字节前加上缓冲
// 使 TLS 库能重新读取完整的握手数据
type ja3Conn struct {
	net.Conn
	reader io.Reader
}

func (c *ja3Conn) Read(b []byte) (int, error) {
	return c.reader.Read(b)
}

// JA3Listener 包装 TCP Listener，在 Accept 时截获 ClientHello 并计算 JA3
type JA3Listener struct {
	inner  net.Listener
	JA3Map *sync.Map // remoteAddr -> ja3Hash string
}

func (l *JA3Listener) Accept() (net.Conn, error) {
	conn, err := l.inner.Accept()
	if err != nil {
		return nil, err
	}

	// 读取 TLS Record Header (5 字节)
	header := make([]byte, 5)
	if _, err := io.ReadFull(conn, header); err != nil {
		conn.Close()
		return nil, err
	}

	// 非 TLS 握手，返回缓冲连接
	if header[0] != 0x16 {
		return &ja3Conn{
			Conn:   conn,
			reader: io.MultiReader(bytes.NewReader(header), conn),
		}, nil
	}

	// 读取完整 TLS 记录
	recordLen := int(binary.BigEndian.Uint16(header[3:5]))
	if recordLen > 16384 { // TLS 记录最大 16KB
		recordLen = 16384
	}
	record := make([]byte, recordLen)
	if _, err := io.ReadFull(conn, record); err != nil {
		conn.Close()
		return nil, err
	}

	// 计算 JA3
	raw := append(header, record...)
	hash, _, err := ComputeJA3(raw)
	if err != nil {
		log.Printf("[JA3] 解析失败 %s: %v", conn.RemoteAddr(), err)
		hash = ""
	}

	// 存储 JA3 hash，后续 HTTP handler 通过 ConnContext 取出
	l.JA3Map.Store(conn.RemoteAddr().String(), hash)

	// 返回缓冲连接，TLS 库会重新读取这些字节完成握手
	return &ja3Conn{
		Conn:   conn,
		reader: io.MultiReader(bytes.NewReader(raw), conn),
	}, nil
}

func (l *JA3Listener) Close() error {
	return l.inner.Close()
}

func (l *JA3Listener) Addr() net.Addr {
	return l.inner.Addr()
}
