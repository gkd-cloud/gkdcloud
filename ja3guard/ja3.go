package main

import (
	"crypto/md5"
	"encoding/binary"
	"fmt"
	"strings"
)

// GREASE 值 (RFC 8701)，JA3 计算时需过滤
var greaseValues = map[uint16]bool{
	0x0a0a: true, 0x1a1a: true, 0x2a2a: true, 0x3a3a: true,
	0x4a4a: true, 0x5a5a: true, 0x6a6a: true, 0x7a7a: true,
	0x8a8a: true, 0x9a9a: true, 0xaaaa: true, 0xbaba: true,
	0xcaca: true, 0xdada: true, 0xeaea: true, 0xfafa: true,
}

func isGREASE(v uint16) bool {
	return greaseValues[v]
}

// ComputeJA3 从原始 TLS ClientHello 记录字节计算 JA3 指纹。
// 输入: 完整的 TLS 记录（含 5 字节记录头）。
// 返回: JA3 hash (MD5 hex), JA3 原始字符串, error。
func ComputeJA3(raw []byte) (hash string, ja3String string, err error) {
	// 最小长度: 5(记录头) + 4(握手头) + 2(版本) + 32(随机数) + 1(session ID 长度)
	if len(raw) < 44 {
		return "", "", fmt.Errorf("数据过短: %d 字节", len(raw))
	}

	// --- TLS Record Header ---
	if raw[0] != 0x16 {
		return "", "", fmt.Errorf("非握手记录: 0x%02x", raw[0])
	}

	recordLen := int(binary.BigEndian.Uint16(raw[3:5]))
	payload := raw[5:]
	if len(payload) < recordLen {
		return "", "", fmt.Errorf("记录截断: 期望 %d, 实际 %d", recordLen, len(payload))
	}
	payload = payload[:recordLen]

	// --- Handshake Header ---
	if payload[0] != 0x01 {
		return "", "", fmt.Errorf("非 ClientHello: 0x%02x", payload[0])
	}

	ch := payload[4:] // 跳过握手头 (type + 3 bytes length)
	if len(ch) < 34 {
		return "", "", fmt.Errorf("ClientHello 过短")
	}

	// --- ClientHello 字段 ---
	// JA3 字段 1: TLS 版本
	tlsVersion := binary.BigEndian.Uint16(ch[0:2])
	pos := 34 // 跳过 version(2) + random(32)

	// Session ID
	if pos >= len(ch) {
		return "", "", fmt.Errorf("Session ID 处截断")
	}
	sessionIDLen := int(ch[pos])
	pos += 1 + sessionIDLen

	// JA3 字段 2: Cipher Suites
	if pos+2 > len(ch) {
		return "", "", fmt.Errorf("Cipher Suites 处截断")
	}
	cipherSuitesLen := int(binary.BigEndian.Uint16(ch[pos : pos+2]))
	pos += 2
	if pos+cipherSuitesLen > len(ch) {
		return "", "", fmt.Errorf("Cipher Suites 数据截断")
	}

	var cipherSuites []string
	for i := 0; i < cipherSuitesLen; i += 2 {
		cs := binary.BigEndian.Uint16(ch[pos+i : pos+i+2])
		if !isGREASE(cs) {
			cipherSuites = append(cipherSuites, fmt.Sprintf("%d", cs))
		}
	}
	pos += cipherSuitesLen

	// Compression Methods (跳过)
	if pos >= len(ch) {
		return "", "", fmt.Errorf("压缩方法处截断")
	}
	compLen := int(ch[pos])
	pos += 1 + compLen

	// JA3 字段 3/4/5: Extensions / Elliptic Curves / EC Point Formats
	var extensions []string
	var curves []string
	var pointFormats []string

	if pos+2 <= len(ch) {
		extTotalLen := int(binary.BigEndian.Uint16(ch[pos : pos+2]))
		pos += 2
		extEnd := pos + extTotalLen
		if extEnd > len(ch) {
			extEnd = len(ch)
		}

		for pos+4 <= extEnd {
			extType := binary.BigEndian.Uint16(ch[pos : pos+2])
			extDataLen := int(binary.BigEndian.Uint16(ch[pos+2 : pos+4]))
			extDataStart := pos + 4

			if !isGREASE(extType) {
				extensions = append(extensions, fmt.Sprintf("%d", extType))

				// 0x000a = supported_groups (elliptic_curves)
				if extType == 0x000a && extDataStart+2 <= extEnd {
					listLen := int(binary.BigEndian.Uint16(ch[extDataStart : extDataStart+2]))
					for j := 2; j+1 < 2+listLen && extDataStart+j+1 < extEnd; j += 2 {
						curve := binary.BigEndian.Uint16(ch[extDataStart+j : extDataStart+j+2])
						if !isGREASE(curve) {
							curves = append(curves, fmt.Sprintf("%d", curve))
						}
					}
				}

				// 0x000b = ec_point_formats
				if extType == 0x000b && extDataStart+1 <= extEnd {
					listLen := int(ch[extDataStart])
					for j := 1; j < 1+listLen && extDataStart+j < extEnd; j++ {
						pointFormats = append(pointFormats, fmt.Sprintf("%d", ch[extDataStart+j]))
					}
				}
			}

			pos = extDataStart + extDataLen
		}
	}

	// 构建 JA3 字符串: TLSVersion,Ciphers,Extensions,EllipticCurves,EllipticCurvePointFormats
	ja3 := fmt.Sprintf("%d,%s,%s,%s,%s",
		tlsVersion,
		strings.Join(cipherSuites, "-"),
		strings.Join(extensions, "-"),
		strings.Join(curves, "-"),
		strings.Join(pointFormats, "-"),
	)

	h := md5.Sum([]byte(ja3))
	return fmt.Sprintf("%x", h), ja3, nil
}
