package subscription

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ProxyNode 代表解析后的统一代理节点
type ProxyNode struct {
	Name     string            `json:"name" yaml:"name"`
	Type     string            `json:"type" yaml:"type"` // vmess, vless, trojan, ss, ssr, hysteria2
	Server   string            `json:"server" yaml:"server"`
	Port     int               `json:"port" yaml:"port"`
	UUID     string            `json:"uuid,omitempty" yaml:"uuid,omitempty"`
	Password string            `json:"password,omitempty" yaml:"password,omitempty"`
	AlterId  int               `json:"alterId,omitempty" yaml:"alterId,omitempty"`
	Cipher   string            `json:"cipher,omitempty" yaml:"cipher,omitempty"`
	TLS      bool              `json:"tls,omitempty" yaml:"tls,omitempty"`
	SNI      string            `json:"sni,omitempty" yaml:"sni,omitempty"`
	Network  string            `json:"network,omitempty" yaml:"network,omitempty"` // tcp, ws, grpc, h2
	WSOpts   *WSOptions        `json:"ws-opts,omitempty" yaml:"ws-opts,omitempty"`
	GRPCOpts *GRPCOptions      `json:"grpc-opts,omitempty" yaml:"grpc-opts,omitempty"`
	H2Opts   *H2Options        `json:"h2-opts,omitempty" yaml:"h2-opts,omitempty"`
	Plugin   string            `json:"plugin,omitempty" yaml:"plugin,omitempty"`
	PlugOpts map[string]string `json:"plugin-opts,omitempty" yaml:"plugin-opts,omitempty"`
	UDP      bool              `json:"udp,omitempty" yaml:"udp,omitempty"`
	// Reality 相关
	RealityOpts *RealityOptions `json:"reality-opts,omitempty" yaml:"reality-opts,omitempty"`
	Flow        string          `json:"flow,omitempty" yaml:"flow,omitempty"`
	// Hysteria2 相关
	Up         string `json:"up,omitempty" yaml:"up,omitempty"`
	Down       string `json:"down,omitempty" yaml:"down,omitempty"`
	Obfs       string `json:"obfs,omitempty" yaml:"obfs,omitempty"`
	ObfsPasswd string `json:"obfs-password,omitempty" yaml:"obfs-password,omitempty"`
}

type WSOptions struct {
	Path    string            `json:"path,omitempty" yaml:"path,omitempty"`
	Headers map[string]string `json:"headers,omitempty" yaml:"headers,omitempty"`
}

type GRPCOptions struct {
	ServiceName string `json:"grpc-service-name,omitempty" yaml:"grpc-service-name,omitempty"`
}

type H2Options struct {
	Host []string `json:"host,omitempty" yaml:"host,omitempty"`
	Path string   `json:"path,omitempty" yaml:"path,omitempty"`
}

type RealityOptions struct {
	PublicKey string `json:"public-key,omitempty" yaml:"public-key,omitempty"`
	ShortID   string `json:"short-id,omitempty" yaml:"short-id,omitempty"`
}

// SubscriptionResult 订阅解析结果
type SubscriptionResult struct {
	Nodes    []ProxyNode `json:"nodes"`
	Traffic  *TrafficInfo `json:"traffic,omitempty"`
	ExpireAt int64       `json:"expire_at,omitempty"`
}

type TrafficInfo struct {
	Upload   int64 `json:"upload"`
	Download int64 `json:"download"`
	Total    int64 `json:"total"`
}

// PanelType 面板类型
type PanelType string

const (
	PanelSSPanel PanelType = "sspanel"
	PanelV2Board PanelType = "v2board"
)

// Converter 订阅转换器接口
type Converter interface {
	// Parse 解析原始订阅内容为统一节点格式
	Parse(rawContent string) (*SubscriptionResult, error)
	// PanelType 返回面板类型
	PanelType() PanelType
}

// Base64Decode 安全的 Base64 解码，同时支持标准和 URL-safe 编码
func Base64Decode(encoded string) (string, error) {
	// 去除空白字符
	encoded = strings.TrimSpace(encoded)
	// 补齐 padding
	if mod := len(encoded) % 4; mod != 0 {
		encoded += strings.Repeat("=", 4-mod)
	}
	// 尝试标准编码
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err == nil {
		return string(decoded), nil
	}
	// 尝试 URL-safe 编码
	decoded, err = base64.URLEncoding.DecodeString(encoded)
	if err == nil {
		return string(decoded), nil
	}
	return "", fmt.Errorf("base64 decode failed: %w", err)
}

// ParseVmessLink 解析 vmess:// 链接
func ParseVmessLink(link string) (*ProxyNode, error) {
	if !strings.HasPrefix(link, "vmess://") {
		return nil, fmt.Errorf("not a vmess link")
	}
	raw := strings.TrimPrefix(link, "vmess://")
	decoded, err := Base64Decode(raw)
	if err != nil {
		return nil, fmt.Errorf("decode vmess: %w", err)
	}

	var vmess map[string]interface{}
	if err := json.Unmarshal([]byte(decoded), &vmess); err != nil {
		return nil, fmt.Errorf("parse vmess json: %w", err)
	}

	node := &ProxyNode{
		Type: "vmess",
		UDP:  true,
	}

	if v, ok := vmess["ps"].(string); ok {
		node.Name = v
	}
	if v, ok := vmess["add"].(string); ok {
		node.Server = v
	}
	if v, ok := vmess["port"]; ok {
		node.Port = toInt(v)
	}
	if v, ok := vmess["id"].(string); ok {
		node.UUID = v
	}
	if v, ok := vmess["aid"]; ok {
		node.AlterId = toInt(v)
	}
	if v, ok := vmess["scy"].(string); ok {
		node.Cipher = v
	}
	if node.Cipher == "" {
		node.Cipher = "auto"
	}

	// TLS
	if v, ok := vmess["tls"].(string); ok && v == "tls" {
		node.TLS = true
	}
	if v, ok := vmess["sni"].(string); ok {
		node.SNI = v
	}

	// 传输协议
	if v, ok := vmess["net"].(string); ok {
		node.Network = v
	}
	switch node.Network {
	case "ws":
		node.WSOpts = &WSOptions{
			Headers: make(map[string]string),
		}
		if v, ok := vmess["path"].(string); ok {
			node.WSOpts.Path = v
		}
		if v, ok := vmess["host"].(string); ok && v != "" {
			node.WSOpts.Headers["Host"] = v
		}
	case "grpc":
		node.GRPCOpts = &GRPCOptions{}
		if v, ok := vmess["path"].(string); ok {
			node.GRPCOpts.ServiceName = v
		}
	case "h2":
		node.H2Opts = &H2Options{}
		if v, ok := vmess["path"].(string); ok {
			node.H2Opts.Path = v
		}
		if v, ok := vmess["host"].(string); ok && v != "" {
			node.H2Opts.Host = strings.Split(v, ",")
		}
	}

	return node, nil
}

// ParseVlessLink 解析 vless:// 链接
func ParseVlessLink(link string) (*ProxyNode, error) {
	if !strings.HasPrefix(link, "vless://") {
		return nil, fmt.Errorf("not a vless link")
	}
	u, err := url.Parse(link)
	if err != nil {
		return nil, fmt.Errorf("parse vless url: %w", err)
	}

	port, _ := strconv.Atoi(u.Port())
	node := &ProxyNode{
		Type:   "vless",
		Server: u.Hostname(),
		Port:   port,
		UUID:   u.User.Username(),
		Name:   u.Fragment,
		UDP:    true,
	}

	query := u.Query()

	// TLS & Security
	security := query.Get("security")
	if security == "tls" || security == "reality" {
		node.TLS = true
	}
	if sni := query.Get("sni"); sni != "" {
		node.SNI = sni
	}
	if flow := query.Get("flow"); flow != "" {
		node.Flow = flow
	}

	// Reality
	if security == "reality" {
		node.RealityOpts = &RealityOptions{
			PublicKey: query.Get("pbk"),
			ShortID:  query.Get("sid"),
		}
	}

	// 传输协议
	node.Network = query.Get("type")
	if node.Network == "" {
		node.Network = "tcp"
	}

	switch node.Network {
	case "ws":
		node.WSOpts = &WSOptions{
			Path:    query.Get("path"),
			Headers: make(map[string]string),
		}
		if host := query.Get("host"); host != "" {
			node.WSOpts.Headers["Host"] = host
		}
	case "grpc":
		node.GRPCOpts = &GRPCOptions{
			ServiceName: query.Get("serviceName"),
		}
	case "h2":
		node.H2Opts = &H2Options{
			Path: query.Get("path"),
		}
		if host := query.Get("host"); host != "" {
			node.H2Opts.Host = strings.Split(host, ",")
		}
	}

	return node, nil
}

// ParseTrojanLink 解析 trojan:// 链接
func ParseTrojanLink(link string) (*ProxyNode, error) {
	if !strings.HasPrefix(link, "trojan://") {
		return nil, fmt.Errorf("not a trojan link")
	}
	u, err := url.Parse(link)
	if err != nil {
		return nil, fmt.Errorf("parse trojan url: %w", err)
	}

	port, _ := strconv.Atoi(u.Port())
	node := &ProxyNode{
		Type:     "trojan",
		Server:   u.Hostname(),
		Port:     port,
		Password: u.User.Username(),
		Name:     u.Fragment,
		TLS:      true,
		UDP:      true,
	}

	query := u.Query()
	if sni := query.Get("sni"); sni != "" {
		node.SNI = sni
	}
	if peer := query.Get("peer"); peer != "" && node.SNI == "" {
		node.SNI = peer
	}

	// 传输协议
	node.Network = query.Get("type")
	if node.Network == "" {
		node.Network = "tcp"
	}

	switch node.Network {
	case "ws":
		node.WSOpts = &WSOptions{
			Path:    query.Get("path"),
			Headers: make(map[string]string),
		}
		if host := query.Get("host"); host != "" {
			node.WSOpts.Headers["Host"] = host
		}
	case "grpc":
		node.GRPCOpts = &GRPCOptions{
			ServiceName: query.Get("serviceName"),
		}
	}

	return node, nil
}

// ParseSSLink 解析 ss:// 链接
func ParseSSLink(link string) (*ProxyNode, error) {
	if !strings.HasPrefix(link, "ss://") {
		return nil, fmt.Errorf("not a ss link")
	}

	raw := strings.TrimPrefix(link, "ss://")

	// 分离 tag 名称
	var name string
	if idx := strings.Index(raw, "#"); idx != -1 {
		name, _ = url.QueryUnescape(raw[idx+1:])
		raw = raw[:idx]
	}

	// SIP002 格式: userinfo@host:port
	// Legacy 格式: base64(method:password)@host:port
	var cipher, password, server string
	var port int

	if idx := strings.LastIndex(raw, "@"); idx != -1 {
		// SIP002 格式
		userInfo := raw[:idx]
		hostPort := raw[idx+1:]

		decoded, err := Base64Decode(userInfo)
		if err != nil {
			// 可能本身就是明文
			decoded = userInfo
		}

		parts := strings.SplitN(decoded, ":", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid ss userinfo")
		}
		cipher = parts[0]
		password = parts[1]

		h, p, err := splitHostPort(hostPort)
		if err != nil {
			return nil, fmt.Errorf("parse ss host:port: %w", err)
		}
		server = h
		port = p
	} else {
		// 纯 Base64 Legacy 格式
		decoded, err := Base64Decode(raw)
		if err != nil {
			return nil, fmt.Errorf("decode ss base64: %w", err)
		}
		// method:password@host:port
		atIdx := strings.LastIndex(decoded, "@")
		if atIdx == -1 {
			return nil, fmt.Errorf("invalid ss legacy format")
		}
		parts := strings.SplitN(decoded[:atIdx], ":", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid ss method:password")
		}
		cipher = parts[0]
		password = parts[1]

		h, p, err := splitHostPort(decoded[atIdx+1:])
		if err != nil {
			return nil, fmt.Errorf("parse ss host:port: %w", err)
		}
		server = h
		port = p
	}

	return &ProxyNode{
		Name:     name,
		Type:     "ss",
		Server:   server,
		Port:     port,
		Cipher:   cipher,
		Password: password,
		UDP:      true,
	}, nil
}

// ParseHysteria2Link 解析 hysteria2:// 或 hy2:// 链接
func ParseHysteria2Link(link string) (*ProxyNode, error) {
	if !strings.HasPrefix(link, "hysteria2://") && !strings.HasPrefix(link, "hy2://") {
		return nil, fmt.Errorf("not a hysteria2 link")
	}

	u, err := url.Parse(link)
	if err != nil {
		return nil, fmt.Errorf("parse hysteria2 url: %w", err)
	}

	port, _ := strconv.Atoi(u.Port())
	node := &ProxyNode{
		Type:     "hysteria2",
		Server:   u.Hostname(),
		Port:     port,
		Password: u.User.Username(),
		Name:     u.Fragment,
		TLS:      true,
		UDP:      true,
	}

	query := u.Query()
	if sni := query.Get("sni"); sni != "" {
		node.SNI = sni
	}
	if obfs := query.Get("obfs"); obfs != "" {
		node.Obfs = obfs
		node.ObfsPasswd = query.Get("obfs-password")
	}

	return node, nil
}

// ParseSubscriptionContent 解析 Base64 编码的订阅内容（通用格式）
func ParseSubscriptionContent(content string) ([]ProxyNode, error) {
	decoded, err := Base64Decode(content)
	if err != nil {
		// 可能不是 base64，直接当明文处理
		decoded = content
	}

	lines := strings.Split(strings.TrimSpace(decoded), "\n")
	var nodes []ProxyNode

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var node *ProxyNode
		var parseErr error

		switch {
		case strings.HasPrefix(line, "vmess://"):
			node, parseErr = ParseVmessLink(line)
		case strings.HasPrefix(line, "vless://"):
			node, parseErr = ParseVlessLink(line)
		case strings.HasPrefix(line, "trojan://"):
			node, parseErr = ParseTrojanLink(line)
		case strings.HasPrefix(line, "ss://"):
			node, parseErr = ParseSSLink(line)
		case strings.HasPrefix(line, "hysteria2://"), strings.HasPrefix(line, "hy2://"):
			node, parseErr = ParseHysteria2Link(line)
		default:
			continue // 跳过不支持的协议
		}

		if parseErr != nil {
			// 记录错误但继续解析其他节点
			continue
		}
		if node != nil {
			nodes = append(nodes, *node)
		}
	}

	if len(nodes) == 0 {
		return nil, fmt.Errorf("no valid proxy nodes found")
	}
	return nodes, nil
}

// 辅助函数

func toInt(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case string:
		n, _ := strconv.Atoi(val)
		return n
	case int:
		return val
	default:
		return 0
	}
}

func splitHostPort(hostPort string) (string, int, error) {
	// 处理 IPv6
	if strings.HasPrefix(hostPort, "[") {
		idx := strings.LastIndex(hostPort, "]:")
		if idx == -1 {
			return "", 0, fmt.Errorf("invalid host:port format")
		}
		host := hostPort[1:idx]
		port, err := strconv.Atoi(hostPort[idx+2:])
		if err != nil {
			return "", 0, err
		}
		return host, port, nil
	}

	idx := strings.LastIndex(hostPort, ":")
	if idx == -1 {
		return "", 0, fmt.Errorf("missing port")
	}
	host := hostPort[:idx]
	port, err := strconv.Atoi(hostPort[idx+1:])
	if err != nil {
		return "", 0, err
	}
	return host, port, nil
}
