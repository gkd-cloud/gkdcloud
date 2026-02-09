package masking

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
)

// MaskConfig 域名伪装配置
type MaskConfig struct {
	// Enable 是否启用域名伪装
	Enable bool `json:"enable" yaml:"enable"`
	// Rules 域名替换规则列表
	Rules []MaskRule `json:"rules" yaml:"rules"`
	// PortMapping 端口映射规则
	PortMapping []PortMapRule `json:"port_mapping,omitempty" yaml:"port-mapping,omitempty"`
	// SNIRewrite SNI 重写规则（伪装 TLS 握手中的 SNI）
	SNIRewrite []SNIRewriteRule `json:"sni_rewrite,omitempty" yaml:"sni-rewrite,omitempty"`
	// HostHeaderRewrite Host 头重写（伪装 HTTP 请求中的 Host）
	HostHeaderRewrite []HostRewriteRule `json:"host_header_rewrite,omitempty" yaml:"host-header-rewrite,omitempty"`
}

// MaskRule 单条域名伪装规则
type MaskRule struct {
	// MatchType 匹配方式: "exact", "suffix", "prefix", "regex", "wildcard"
	MatchType string `json:"match_type" yaml:"match-type"`
	// Pattern 匹配模式
	Pattern string `json:"pattern" yaml:"pattern"`
	// Replace 替换域名
	Replace string `json:"replace" yaml:"replace"`
	// Comment 规则备注
	Comment string `json:"comment,omitempty" yaml:"comment,omitempty"`

	// 内部使用：编译后的正则
	compiledRegex *regexp.Regexp
}

// PortMapRule 端口映射规则
type PortMapRule struct {
	// OriginalPort 原始端口
	OriginalPort int `json:"original_port" yaml:"original-port"`
	// MappedPort 映射后的端口
	MappedPort int `json:"mapped_port" yaml:"mapped-port"`
	// ServerMatch 仅对匹配的服务器生效（可选，留空则全局生效）
	ServerMatch string `json:"server_match,omitempty" yaml:"server-match,omitempty"`
	// Comment 备注
	Comment string `json:"comment,omitempty" yaml:"comment,omitempty"`
}

// SNIRewriteRule SNI 重写规则
type SNIRewriteRule struct {
	// OriginalSNI 原始 SNI
	OriginalSNI string `json:"original_sni" yaml:"original-sni"`
	// NewSNI 替换后的 SNI
	NewSNI string `json:"new_sni" yaml:"new-sni"`
	// Comment 备注
	Comment string `json:"comment,omitempty" yaml:"comment,omitempty"`
}

// HostRewriteRule Host 头重写规则
type HostRewriteRule struct {
	// OriginalHost 原始 Host
	OriginalHost string `json:"original_host" yaml:"original-host"`
	// NewHost 替换后的 Host
	NewHost string `json:"new_host" yaml:"new-host"`
	// Comment 备注
	Comment string `json:"comment,omitempty" yaml:"comment,omitempty"`
}

// DomainMasker 域名伪装引擎
type DomainMasker struct {
	config *MaskConfig
	mu     sync.RWMutex
}

// NewDomainMasker 创建域名伪装引擎
func NewDomainMasker(config *MaskConfig) (*DomainMasker, error) {
	if config == nil {
		config = &MaskConfig{Enable: false}
	}

	// 编译正则规则
	for i := range config.Rules {
		if config.Rules[i].MatchType == "regex" {
			compiled, err := regexp.Compile(config.Rules[i].Pattern)
			if err != nil {
				return nil, fmt.Errorf("compile regex rule %d (%s): %w", i, config.Rules[i].Pattern, err)
			}
			config.Rules[i].compiledRegex = compiled
		}
	}

	return &DomainMasker{config: config}, nil
}

// LoadConfigFromFile 从文件加载配置
func LoadConfigFromFile(path string) (*MaskConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	var config MaskConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	return &config, nil
}

// SaveConfigToFile 保存配置到文件
func (m *DomainMasker) SaveConfigToFile(path string) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.MarshalIndent(m.config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

// MaskDomain 对单个域名进行伪装替换
func (m *DomainMasker) MaskDomain(domain string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if !m.config.Enable || len(m.config.Rules) == 0 {
		return domain
	}

	for _, rule := range m.config.Rules {
		if matched, result := rule.Apply(domain); matched {
			return result
		}
	}

	return domain
}

// MaskPort 对端口进行映射
func (m *DomainMasker) MaskPort(port int, server string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, rule := range m.config.PortMapping {
		if rule.OriginalPort == port {
			if rule.ServerMatch == "" || matchesPattern(server, rule.ServerMatch) {
				return rule.MappedPort
			}
		}
	}

	return port
}

// MaskSNI 对 SNI 进行重写
func (m *DomainMasker) MaskSNI(sni string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, rule := range m.config.SNIRewrite {
		if rule.OriginalSNI == sni || matchesPattern(sni, rule.OriginalSNI) {
			return rule.NewSNI
		}
	}

	return sni
}

// MaskHostHeader 对 Host 头进行重写
func (m *DomainMasker) MaskHostHeader(host string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, rule := range m.config.HostHeaderRewrite {
		if rule.OriginalHost == host || matchesPattern(host, rule.OriginalHost) {
			return rule.NewHost
		}
	}

	return host
}

// Apply 应用单条规则
func (r *MaskRule) Apply(domain string) (bool, string) {
	switch r.MatchType {
	case "exact":
		if domain == r.Pattern {
			return true, r.Replace
		}
	case "suffix":
		if strings.HasSuffix(domain, r.Pattern) {
			// 替换后缀
			prefix := strings.TrimSuffix(domain, r.Pattern)
			return true, prefix + r.Replace
		}
	case "prefix":
		if strings.HasPrefix(domain, r.Pattern) {
			suffix := strings.TrimPrefix(domain, r.Pattern)
			return true, r.Replace + suffix
		}
	case "wildcard":
		if matchWildcard(domain, r.Pattern) {
			return true, r.Replace
		}
	case "regex":
		if r.compiledRegex != nil && r.compiledRegex.MatchString(domain) {
			result := r.compiledRegex.ReplaceAllString(domain, r.Replace)
			return true, result
		}
	}
	return false, ""
}

// ProxyNodeMasker 对代理节点列表批量应用域名伪装
type ProxyNodeMasker struct {
	masker *DomainMasker
}

func NewProxyNodeMasker(masker *DomainMasker) *ProxyNodeMasker {
	return &ProxyNodeMasker{masker: masker}
}

// MaskNodeFields 对节点的所有域名相关字段进行伪装
// 接受通用 map 格式的节点数据，返回处理后的数据
func (p *ProxyNodeMasker) MaskNodeFields(node map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range node {
		result[k] = v
	}

	// 伪装 server 字段
	if server, ok := result["server"].(string); ok {
		result["server"] = p.masker.MaskDomain(server)
	}

	// 伪装端口
	if port, ok := result["port"].(int); ok {
		server, _ := result["server"].(string)
		result["port"] = p.masker.MaskPort(port, server)
	}

	// 伪装 SNI
	if sni, ok := result["sni"].(string); ok {
		result["sni"] = p.masker.MaskSNI(sni)
	}

	// 伪装 WebSocket Host
	if wsOpts, ok := result["ws-opts"].(map[string]interface{}); ok {
		newWSOpts := make(map[string]interface{})
		for k, v := range wsOpts {
			newWSOpts[k] = v
		}
		if headers, ok := newWSOpts["headers"].(map[string]interface{}); ok {
			newHeaders := make(map[string]interface{})
			for k, v := range headers {
				newHeaders[k] = v
			}
			if host, ok := newHeaders["Host"].(string); ok {
				newHeaders["Host"] = p.masker.MaskHostHeader(host)
			}
			newWSOpts["headers"] = newHeaders
		}
		result["ws-opts"] = newWSOpts
	}

	// 伪装 H2 Host
	if h2Opts, ok := result["h2-opts"].(map[string]interface{}); ok {
		newH2Opts := make(map[string]interface{})
		for k, v := range h2Opts {
			newH2Opts[k] = v
		}
		if hosts, ok := newH2Opts["host"].([]interface{}); ok {
			var newHosts []interface{}
			for _, h := range hosts {
				if host, ok := h.(string); ok {
					newHosts = append(newHosts, p.masker.MaskHostHeader(host))
				} else {
					newHosts = append(newHosts, h)
				}
			}
			newH2Opts["host"] = newHosts
		}
		result["h2-opts"] = newH2Opts
	}

	return result
}

// UpdateConfig 更新伪装配置（热更新，无需重启）
func (m *DomainMasker) UpdateConfig(newConfig *MaskConfig) error {
	// 编译新规则的正则
	for i := range newConfig.Rules {
		if newConfig.Rules[i].MatchType == "regex" {
			compiled, err := regexp.Compile(newConfig.Rules[i].Pattern)
			if err != nil {
				return fmt.Errorf("compile regex rule %d: %w", i, err)
			}
			newConfig.Rules[i].compiledRegex = compiled
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.config = newConfig
	return nil
}

// GetConfig 获取当前配置（只读副本）
func (m *DomainMasker) GetConfig() MaskConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return *m.config
}

// ExampleMaskConfig 返回一个示例配置，用于参考
func ExampleMaskConfig() *MaskConfig {
	return &MaskConfig{
		Enable: true,
		Rules: []MaskRule{
			{
				MatchType: "exact",
				Pattern:   "node1.real-domain.com",
				Replace:   "cdn1.masked-domain.com",
				Comment:   "节点1 域名伪装",
			},
			{
				MatchType: "suffix",
				Pattern:   ".real-domain.com",
				Replace:   ".cdn-masked.com",
				Comment:   "批量替换所有 real-domain.com 的子域名",
			},
			{
				MatchType: "regex",
				Pattern:   `node(\d+)\.example\.com`,
				Replace:   "cdn-$1.masked.com",
				Comment:   "使用正则批量替换带数字编号的节点域名",
			},
		},
		PortMapping: []PortMapRule{
			{
				OriginalPort: 443,
				MappedPort:   8443,
				Comment:      "将 443 端口映射到 8443，避免常见端口被封",
			},
			{
				OriginalPort: 80,
				MappedPort:   8080,
				Comment:      "HTTP 端口映射",
			},
		},
		SNIRewrite: []SNIRewriteRule{
			{
				OriginalSNI: "node1.real-domain.com",
				NewSNI:      "www.microsoft.com",
				Comment:     "SNI 伪装为微软域名",
			},
		},
		HostHeaderRewrite: []HostRewriteRule{
			{
				OriginalHost: "node1.real-domain.com",
				NewHost:      "cdn1.masked-domain.com",
				Comment:      "WebSocket Host 头伪装",
			},
		},
	}
}

// 辅助函数

func matchWildcard(str, pattern string) bool {
	// 简单的通配符匹配：* 匹配任意字符串
	parts := strings.Split(pattern, "*")
	if len(parts) == 1 {
		return str == pattern
	}

	// 检查前缀
	if !strings.HasPrefix(str, parts[0]) {
		return false
	}
	str = str[len(parts[0]):]

	// 检查中间部分
	for i := 1; i < len(parts)-1; i++ {
		idx := strings.Index(str, parts[i])
		if idx == -1 {
			return false
		}
		str = str[idx+len(parts[i]):]
	}

	// 检查后缀
	return strings.HasSuffix(str, parts[len(parts)-1])
}

func matchesPattern(str, pattern string) bool {
	if strings.Contains(pattern, "*") {
		return matchWildcard(str, pattern)
	}
	return str == pattern
}
