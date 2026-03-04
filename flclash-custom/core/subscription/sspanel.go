package subscription

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// SSPanelConverter SSPanel-Metron 订阅转换器
type SSPanelConverter struct {
	client *http.Client
}

func NewSSPanelConverter() *SSPanelConverter {
	return &SSPanelConverter{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *SSPanelConverter) PanelType() PanelType {
	return PanelSSPanel
}

// FetchAndParse 从 SSPanel 订阅链接获取并解析节点
// SSPanel-Metron 订阅返回格式通常是 Base64 编码的节点链接列表
func (c *SSPanelConverter) FetchAndParse(subURL string) (*SubscriptionResult, error) {
	req, err := http.NewRequest("GET", subURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// 设置 User-Agent 模拟常见客户端
	req.Header.Set("User-Agent", "ClashForAndroid/2.5.12")

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

	// 解析流量信息（从 HTTP Header 中获取）
	result.Traffic = parseSSPanelTrafficHeaders(resp.Header)

	// 解析过期时间
	if expire := resp.Header.Get("subscription-userinfo"); expire != "" {
		result.ExpireAt = parseExpireFromUserInfo(expire)
	}

	// SSPanel 可能返回两种格式：
	// 1. Base64 编码的代理链接列表（每行一个链接）
	// 2. Clash YAML 配置
	content := string(body)

	// 检查是否是 Clash YAML 格式
	if isClashConfig(content) {
		nodes, err := parseClashConfig(content)
		if err != nil {
			return nil, fmt.Errorf("parse clash config: %w", err)
		}
		result.Nodes = nodes
		return result, nil
	}

	// Base64 编码的链接列表
	nodes, err := ParseSubscriptionContent(content)
	if err != nil {
		return nil, fmt.Errorf("parse subscription: %w", err)
	}
	result.Nodes = nodes

	return result, nil
}

// Parse 解析原始订阅内容
func (c *SSPanelConverter) Parse(rawContent string) (*SubscriptionResult, error) {
	result := &SubscriptionResult{}

	if isClashConfig(rawContent) {
		nodes, err := parseClashConfig(rawContent)
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

// SSPanel API 模式：通过 WebAPI 获取节点列表
type SSPanelAPIConverter struct {
	client    *http.Client
	apiURL    string
	apiKey    string
	nodeID    int
}

func NewSSPanelAPIConverter(apiURL, apiKey string, nodeID int) *SSPanelAPIConverter {
	return &SSPanelAPIConverter{
		client: &http.Client{Timeout: 30 * time.Second},
		apiURL: strings.TrimRight(apiURL, "/"),
		apiKey: apiKey,
		nodeID: nodeID,
	}
}

// FetchNodeInfo 通过 SSPanel WebAPI 获取节点信息
func (c *SSPanelAPIConverter) FetchNodeInfo() (*SSPanelNodeInfo, error) {
	url := fmt.Sprintf("%s/mod_mu/nodes/%d/info?key=%s", c.apiURL, c.nodeID, c.apiKey)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch node info: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Ret  int             `json:"ret"`
		Data json.RawMessage `json:"data"`
		Msg  string          `json:"msg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if result.Ret != 1 {
		return nil, fmt.Errorf("api error: %s", result.Msg)
	}

	var nodeInfo SSPanelNodeInfo
	if err := json.Unmarshal(result.Data, &nodeInfo); err != nil {
		return nil, fmt.Errorf("decode node info: %w", err)
	}

	return &nodeInfo, nil
}

type SSPanelNodeInfo struct {
	NodeID      int    `json:"node_id"`
	NodeType    string `json:"node_type"` // V2Ray, Trojan, Shadowsocks
	Server      string `json:"server"`
	ServerPort  int    `json:"server_port"`
	Sort        int    `json:"sort"`
	TrafficRate float64 `json:"traffic_rate"`
	// V2Ray 特有
	V2AlterId  int    `json:"v2_alter_id"`
	V2Port     int    `json:"v2_port"`
	V2Method   string `json:"v2_method"`
	V2Net      string `json:"v2_net"`
	V2Type     string `json:"v2_type"`
	V2Host     string `json:"v2_host"`
	V2Path     string `json:"v2_path"`
	V2TLS      int    `json:"v2_tls"`
	V2TLSProvider string `json:"v2_tls_provider"`
}

// 辅助函数

func parseSSPanelTrafficHeaders(headers http.Header) *TrafficInfo {
	userInfo := headers.Get("Subscription-Userinfo")
	if userInfo == "" {
		return nil
	}

	info := &TrafficInfo{}
	parts := strings.Split(userInfo, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val, _ := strconv.ParseInt(strings.TrimSpace(kv[1]), 10, 64)

		switch key {
		case "upload":
			info.Upload = val
		case "download":
			info.Download = val
		case "total":
			info.Total = val
		}
	}

	return info
}

func parseExpireFromUserInfo(userInfo string) int64 {
	parts := strings.Split(userInfo, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 && strings.TrimSpace(kv[0]) == "expire" {
			expire, _ := strconv.ParseInt(strings.TrimSpace(kv[1]), 10, 64)
			return expire
		}
	}
	return 0
}

func isClashConfig(content string) bool {
	trimmed := strings.TrimSpace(content)
	return strings.HasPrefix(trimmed, "proxies:") ||
		strings.HasPrefix(trimmed, "port:") ||
		strings.Contains(trimmed, "\nproxies:")
}

// parseClashConfig 解析 Clash YAML 格式配置中的 proxies 节点
// 这里做简化解析，实际集成时可以使用 FlClash 自带的 YAML 解析器
func parseClashConfig(content string) ([]ProxyNode, error) {
	// Clash 配置的完整 YAML 解析在 FlClash 核心中已有实现
	// 这里仅提供基础解析能力，用于预处理和域名伪装
	// 实际使用时会将处理后的配置交给 clash-meta 核心
	var nodes []ProxyNode

	// 简化实现：提取 proxies 段并逐个解析
	// 完整实现应使用 gopkg.in/yaml.v3
	_ = content
	_ = nodes

	return nodes, fmt.Errorf("clash yaml parsing delegated to core engine")
}
