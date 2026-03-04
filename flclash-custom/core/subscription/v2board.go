package subscription

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// V2BoardConverter V2Board 订阅转换器
type V2BoardConverter struct {
	client *http.Client
}

func NewV2BoardConverter() *V2BoardConverter {
	return &V2BoardConverter{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *V2BoardConverter) PanelType() PanelType {
	return PanelV2Board
}

// FetchAndParse 从 V2Board 订阅链接获取并解析节点
// V2Board 支持多种订阅格式，通过 URL 参数 flag 指定
func (c *V2BoardConverter) FetchAndParse(subURL string) (*SubscriptionResult, error) {
	// V2Board 的订阅链接格式通常为：
	// https://panel.example.com/api/v1/client/subscribe?token=xxxxx
	// 可以添加 flag=clash 来获取 clash 格式

	req, err := http.NewRequest("GET", subURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// 不指定 flag 获取原始格式（Base64 编码的链接列表）
	req.Header.Set("User-Agent", "ClashMeta/1.0")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("subscription returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	result := &SubscriptionResult{}

	// 解析流量信息（V2Board 同样通过 HTTP Header 传递）
	result.Traffic = parseSSPanelTrafficHeaders(resp.Header)
	result.ExpireAt = parseExpireFromUserInfo(resp.Header.Get("Subscription-Userinfo"))

	content := string(body)

	// 检查是否是 Clash 配置
	if isClashConfig(content) {
		nodes, err := parseClashConfig(content)
		if err != nil {
			return nil, fmt.Errorf("parse clash config: %w", err)
		}
		result.Nodes = nodes
		return result, nil
	}

	// 检查是否是 V2Board JSON 格式
	if isV2BoardJSON(content) {
		nodes, err := parseV2BoardJSON(content)
		if err != nil {
			return nil, fmt.Errorf("parse v2board json: %w", err)
		}
		result.Nodes = nodes
		return result, nil
	}

	// 标准 Base64 编码链接列表
	nodes, err := ParseSubscriptionContent(content)
	if err != nil {
		return nil, fmt.Errorf("parse subscription: %w", err)
	}
	result.Nodes = nodes

	return result, nil
}

// Parse 解析原始订阅内容
func (c *V2BoardConverter) Parse(rawContent string) (*SubscriptionResult, error) {
	result := &SubscriptionResult{}

	if isClashConfig(rawContent) {
		nodes, err := parseClashConfig(rawContent)
		if err != nil {
			return nil, err
		}
		result.Nodes = nodes
		return result, nil
	}

	if isV2BoardJSON(rawContent) {
		nodes, err := parseV2BoardJSON(rawContent)
		if err != nil {
			return nil, err
		}
		result.Nodes = nodes
		return result, nil
	}

	nodes, err := ParseSubscriptionContent(rawContent)
	if err != nil {
		return nil, err
	}
	result.Nodes = nodes
	return result, nil
}

// V2Board WebAPI 模式
type V2BoardAPIConverter struct {
	client *http.Client
	apiURL string
	apiKey string
}

func NewV2BoardAPIConverter(apiURL, apiKey string) *V2BoardAPIConverter {
	return &V2BoardAPIConverter{
		client: &http.Client{Timeout: 30 * time.Second},
		apiURL: strings.TrimRight(apiURL, "/"),
		apiKey: apiKey,
	}
}

// FetchServerList 获取 V2Board 服务器列表
func (c *V2BoardAPIConverter) FetchServerList(serverType string) ([]V2BoardServer, error) {
	// V2Board API: /api/v1/server/{type}/fetch
	// serverType: vmess, vless, trojan, shadowsocks, hysteria
	url := fmt.Sprintf("%s/api/v1/server/%s/fetch", c.apiURL, serverType)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch server list: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Data []V2BoardServer `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return result.Data, nil
}

// V2BoardServer V2Board 服务器信息
type V2BoardServer struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	ServerPort  int    `json:"server_port"`
	Type        string `json:"type"` // vmess, vless, trojan, shadowsocks, hysteria
	Network     string `json:"network"`
	TLS         int    `json:"tls"`
	TLSSettings *V2BoardTLSSettings `json:"tls_settings"`
	NetworkSettings *V2BoardNetworkSettings `json:"network_settings"`
	// VMess
	AlterID int `json:"alter_id"`
	// Trojan/SS
	Cipher string `json:"cipher"`
	// 节点分组
	GroupID []int  `json:"group_id"`
	Tags    []string `json:"tags"`
	Rate    float64  `json:"rate"`
}

type V2BoardTLSSettings struct {
	ServerName string `json:"server_name"`
	AllowInsecure bool   `json:"allow_insecure"`
	// Reality
	PublicKey string `json:"public_key"`
	ShortID   string `json:"short_id"`
	Dest      string `json:"dest"`
}

type V2BoardNetworkSettings struct {
	// WebSocket
	Path    string            `json:"path"`
	Headers map[string]string `json:"headers"`
	// gRPC
	ServiceName string `json:"serviceName"`
	// HTTP/2
	Host []string `json:"host"`
}

// ToProxyNode 将 V2Board 服务器转为统一节点格式
func (s *V2BoardServer) ToProxyNode() ProxyNode {
	node := ProxyNode{
		Name:   s.Name,
		Server: s.Host,
		Port:   s.ServerPort,
		UDP:    true,
	}
	if node.Port == 0 {
		node.Port = s.Port
	}

	switch s.Type {
	case "vmess":
		node.Type = "vmess"
		node.AlterId = s.AlterID
		node.Cipher = "auto"
	case "vless":
		node.Type = "vless"
	case "trojan":
		node.Type = "trojan"
		node.TLS = true
	case "shadowsocks":
		node.Type = "ss"
		node.Cipher = s.Cipher
	case "hysteria":
		node.Type = "hysteria2"
		node.TLS = true
	}

	// TLS
	if s.TLS == 1 {
		node.TLS = true
	}
	if s.TLSSettings != nil {
		node.SNI = s.TLSSettings.ServerName
		if s.TLSSettings.PublicKey != "" {
			node.RealityOpts = &RealityOptions{
				PublicKey: s.TLSSettings.PublicKey,
				ShortID:  s.TLSSettings.ShortID,
			}
		}
	}

	// Network
	node.Network = s.Network
	if node.Network == "" {
		node.Network = "tcp"
	}
	if s.NetworkSettings != nil {
		switch node.Network {
		case "ws":
			node.WSOpts = &WSOptions{
				Path:    s.NetworkSettings.Path,
				Headers: s.NetworkSettings.Headers,
			}
		case "grpc":
			node.GRPCOpts = &GRPCOptions{
				ServiceName: s.NetworkSettings.ServiceName,
			}
		case "h2":
			node.H2Opts = &H2Options{
				Host: s.NetworkSettings.Host,
				Path: s.NetworkSettings.Path,
			}
		}
	}

	return node
}

// 辅助函数

func isV2BoardJSON(content string) bool {
	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, "{") && !strings.HasPrefix(trimmed, "[") {
		return false
	}
	var js json.RawMessage
	return json.Unmarshal([]byte(trimmed), &js) == nil
}

func parseV2BoardJSON(content string) ([]ProxyNode, error) {
	// V2Board JSON 格式：直接是服务器数组
	var servers []V2BoardServer
	if err := json.Unmarshal([]byte(content), &servers); err != nil {
		// 尝试包装格式
		var wrapper struct {
			Data []V2BoardServer `json:"data"`
		}
		if err2 := json.Unmarshal([]byte(content), &wrapper); err2 != nil {
			return nil, fmt.Errorf("parse v2board json: %w", err)
		}
		servers = wrapper.Data
	}

	var nodes []ProxyNode
	for _, s := range servers {
		node := s.ToProxyNode()
		nodes = append(nodes, node)
	}

	if len(nodes) == 0 {
		return nil, fmt.Errorf("no valid nodes in v2board response")
	}

	return nodes, nil
}
