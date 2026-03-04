package dns

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// DoHConfig 自定义 DoH 配置
type DoHConfig struct {
	// Servers DoH 服务器列表，支持多个上游
	Servers []DoHServer `json:"servers" yaml:"servers"`
	// FallbackServers 备用 DoH 服务器（当主服务器不可用时使用）
	FallbackServers []DoHServer `json:"fallback_servers,omitempty" yaml:"fallback-servers,omitempty"`
	// Strategy 选择策略: "fastest", "random", "round-robin"
	Strategy string `json:"strategy" yaml:"strategy"`
	// CacheTTL DNS 缓存时间（秒），0 表示使用 DNS 记录自身的 TTL
	CacheTTL int `json:"cache_ttl" yaml:"cache-ttl"`
	// CacheSize DNS 缓存条目数量上限
	CacheSize int `json:"cache_size" yaml:"cache-size"`
	// Bootstrap 用于解析 DoH 服务器域名的引导 DNS（IP 地址）
	Bootstrap []string `json:"bootstrap" yaml:"bootstrap"`
	// EnableIPv6 是否启用 IPv6 解析
	EnableIPv6 bool `json:"enable_ipv6" yaml:"enable-ipv6"`
	// HostMapping 静态域名映射（类似 hosts 文件）
	HostMapping map[string]string `json:"host_mapping,omitempty" yaml:"host-mapping,omitempty"`
}

// DoHServer 单个 DoH 服务器配置
type DoHServer struct {
	// URL DoH 服务器地址，如 https://1.1.1.1/dns-query
	URL string `json:"url" yaml:"url"`
	// Name 服务器名称（用于 UI 显示）
	Name string `json:"name" yaml:"name"`
	// Weight 权重（用于加权轮询）
	Weight int `json:"weight,omitempty" yaml:"weight,omitempty"`
	// IP 直连 IP（跳过引导 DNS 解析），用于避免鸡生蛋问题
	IP string `json:"ip,omitempty" yaml:"ip,omitempty"`
}

// DefaultDoHConfig 返回默认的 DoH 配置
func DefaultDoHConfig() *DoHConfig {
	return &DoHConfig{
		Servers: []DoHServer{
			{URL: "https://1.1.1.1/dns-query", Name: "Cloudflare", Weight: 10},
			{URL: "https://8.8.8.8/dns-query", Name: "Google", Weight: 8},
		},
		FallbackServers: []DoHServer{
			{URL: "https://9.9.9.9/dns-query", Name: "Quad9", Weight: 5},
			{URL: "https://223.5.5.5/dns-query", Name: "AliDNS", Weight: 5},
		},
		Strategy:  "fastest",
		CacheTTL:  300,
		CacheSize: 1000,
		Bootstrap: []string{"1.1.1.1", "8.8.8.8"},
	}
}

// DoHResolver 自定义 DoH 解析器
type DoHResolver struct {
	config    *DoHConfig
	client    *http.Client
	cache     *dnsCache
	mu        sync.RWMutex
	latencies map[string]time.Duration // 各服务器延迟记录
	rrIndex   uint32                   // round-robin 索引
}

// NewDoHResolver 创建 DoH 解析器
func NewDoHResolver(config *DoHConfig) *DoHResolver {
	if config == nil {
		config = DefaultDoHConfig()
	}

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
		MaxIdleConns:        20,
		MaxIdleConnsPerHost: 5,
		IdleConnTimeout:     90 * time.Second,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// 如果 DoH 服务器配置了直连 IP，使用它替换域名
			return bootstrapDial(ctx, network, addr, config)
		},
	}

	cacheSize := config.CacheSize
	if cacheSize <= 0 {
		cacheSize = 1000
	}

	return &DoHResolver{
		config: config,
		client: &http.Client{
			Transport: transport,
			Timeout:   10 * time.Second,
		},
		cache:     newDNSCache(cacheSize),
		latencies: make(map[string]time.Duration),
	}
}

// Resolve 解析域名
func (r *DoHResolver) Resolve(domain string) ([]string, error) {
	return r.ResolveWithContext(context.Background(), domain)
}

// ResolveWithContext 带上下文的解析
func (r *DoHResolver) ResolveWithContext(ctx context.Context, domain string) ([]string, error) {
	domain = strings.TrimSuffix(domain, ".")

	// 1. 检查静态映射
	if r.config.HostMapping != nil {
		if ip, ok := r.config.HostMapping[domain]; ok {
			return []string{ip}, nil
		}
	}

	// 2. 检查缓存
	if ips, ok := r.cache.get(domain); ok {
		return ips, nil
	}

	// 3. DoH 解析
	ips, ttl, err := r.doResolve(ctx, domain)
	if err != nil {
		return nil, err
	}

	// 4. 缓存结果
	cacheTTL := time.Duration(ttl) * time.Second
	if r.config.CacheTTL > 0 {
		cacheTTL = time.Duration(r.config.CacheTTL) * time.Second
	}
	r.cache.set(domain, ips, cacheTTL)

	return ips, nil
}

// doResolve 执行实际的 DoH 查询
func (r *DoHResolver) doResolve(ctx context.Context, domain string) ([]string, int, error) {
	server := r.selectServer()
	if server == nil {
		return nil, 0, fmt.Errorf("no available DoH server")
	}

	ips, ttl, err := r.queryDoH(ctx, server, domain)
	if err != nil {
		// 主服务器失败，尝试备用服务器
		for _, fb := range r.config.FallbackServers {
			fbCopy := fb
			ips, ttl, err = r.queryDoH(ctx, &fbCopy, domain)
			if err == nil {
				return ips, ttl, nil
			}
		}
		return nil, 0, fmt.Errorf("all DoH servers failed for %s: %w", domain, err)
	}

	return ips, ttl, nil
}

// queryDoH 向指定 DoH 服务器发送查询
func (r *DoHResolver) queryDoH(ctx context.Context, server *DoHServer, domain string) ([]string, int, error) {
	start := time.Now()

	// 使用 JSON API 格式（RFC 8484 的简化版本）
	queryURL := fmt.Sprintf("%s?name=%s&type=A", server.URL, domain)
	if r.config.EnableIPv6 {
		// 同时查询 AAAA 记录
		queryURL = fmt.Sprintf("%s?name=%s&type=A", server.URL, domain)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", queryURL, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/dns-json")

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	// 记录延迟
	latency := time.Since(start)
	r.mu.Lock()
	r.latencies[server.URL] = latency
	r.mu.Unlock()

	// 解析 DNS JSON 响应
	var dnsResp dnsJSONResponse
	if err := json.Unmarshal(body, &dnsResp); err != nil {
		return nil, 0, fmt.Errorf("parse dns response: %w", err)
	}

	if dnsResp.Status != 0 {
		return nil, 0, fmt.Errorf("dns query failed with status %d", dnsResp.Status)
	}

	var ips []string
	var minTTL int = 300

	for _, answer := range dnsResp.Answer {
		// Type 1 = A, Type 28 = AAAA
		if answer.Type == 1 || (r.config.EnableIPv6 && answer.Type == 28) {
			ips = append(ips, answer.Data)
			if answer.TTL < minTTL {
				minTTL = answer.TTL
			}
		}
	}

	if len(ips) == 0 {
		return nil, 0, fmt.Errorf("no A/AAAA records for %s", domain)
	}

	return ips, minTTL, nil
}

// selectServer 根据策略选择 DoH 服务器
func (r *DoHResolver) selectServer() *DoHServer {
	servers := r.config.Servers
	if len(servers) == 0 {
		return nil
	}

	switch r.config.Strategy {
	case "fastest":
		return r.selectFastest(servers)
	case "random":
		return &servers[rand.Intn(len(servers))]
	case "round-robin":
		r.mu.Lock()
		idx := r.rrIndex % uint32(len(servers))
		r.rrIndex++
		r.mu.Unlock()
		return &servers[idx]
	default:
		return &servers[0]
	}
}

// selectFastest 选择延迟最低的服务器
func (r *DoHResolver) selectFastest(servers []DoHServer) *DoHServer {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.latencies) == 0 {
		return &servers[0]
	}

	type serverLatency struct {
		server  *DoHServer
		latency time.Duration
	}

	var sl []serverLatency
	for i := range servers {
		lat, ok := r.latencies[servers[i].URL]
		if !ok {
			lat = time.Hour // 未测试的给高延迟
		}
		sl = append(sl, serverLatency{&servers[i], lat})
	}

	sort.Slice(sl, func(i, j int) bool {
		return sl[i].latency < sl[j].latency
	})

	return sl[0].server
}

// SpeedTest 对所有服务器进行测速
func (r *DoHResolver) SpeedTest(ctx context.Context) map[string]time.Duration {
	var wg sync.WaitGroup
	results := make(map[string]time.Duration)
	var mu sync.Mutex

	testDomain := "www.google.com"

	allServers := append(r.config.Servers, r.config.FallbackServers...)
	for i := range allServers {
		wg.Add(1)
		go func(s DoHServer) {
			defer wg.Done()
			start := time.Now()
			_, _, err := r.queryDoH(ctx, &s, testDomain)
			latency := time.Since(start)
			if err != nil {
				latency = time.Hour
			}
			mu.Lock()
			results[s.URL] = latency
			r.latencies[s.URL] = latency
			mu.Unlock()
		}(allServers[i])
	}

	wg.Wait()
	return results
}

// GenerateClashDNSConfig 生成 Clash 配置中的 DNS 部分
func (r *DoHResolver) GenerateClashDNSConfig() map[string]interface{} {
	config := map[string]interface{}{
		"enable":            true,
		"listen":            "0.0.0.0:53",
		"enhanced-mode":     "fake-ip",
		"fake-ip-range":     "198.18.0.1/16",
		"use-hosts":         true,
		"default-nameserver": r.config.Bootstrap,
	}

	// 主要 DoH 服务器
	var nameservers []string
	for _, s := range r.config.Servers {
		nameservers = append(nameservers, s.URL)
	}
	config["nameserver"] = nameservers

	// 备用服务器
	if len(r.config.FallbackServers) > 0 {
		var fallback []string
		for _, s := range r.config.FallbackServers {
			fallback = append(fallback, s.URL)
		}
		config["fallback"] = fallback
		config["fallback-filter"] = map[string]interface{}{
			"geoip":      true,
			"geoip-code": "CN",
			"ipcidr":     []string{"240.0.0.0/4"},
		}
	}

	// 静态 hosts
	if len(r.config.HostMapping) > 0 {
		config["hosts"] = r.config.HostMapping
	}

	return config
}

// bootstrapDial 使用引导 DNS 解析 DoH 服务器域名
func bootstrapDial(ctx context.Context, network, addr string, config *DoHConfig) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	// 如果已经是 IP，直接连接
	if net.ParseIP(host) != nil {
		return (&net.Dialer{}).DialContext(ctx, network, addr)
	}

	// 检查服务器是否配置了直连 IP
	for _, s := range config.Servers {
		if s.IP != "" && strings.Contains(s.URL, host) {
			return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(s.IP, port))
		}
	}

	// 使用引导 DNS 解析
	if len(config.Bootstrap) > 0 {
		resolver := &net.Resolver{
			PreferGo: true,
			Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
				d := net.Dialer{}
				return d.DialContext(ctx, "udp", net.JoinHostPort(config.Bootstrap[0], "53"))
			},
		}
		ips, err := resolver.LookupHost(ctx, host)
		if err == nil && len(ips) > 0 {
			return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(ips[0], port))
		}
	}

	// 回退到系统 DNS
	return (&net.Dialer{}).DialContext(ctx, network, addr)
}

// DNS JSON 响应格式
type dnsJSONResponse struct {
	Status int `json:"Status"`
	Answer []struct {
		Name string `json:"name"`
		Type int    `json:"type"`
		TTL  int    `json:"TTL"`
		Data string `json:"data"`
	} `json:"Answer"`
}

// DNS 缓存实现
type dnsCache struct {
	entries map[string]*cacheEntry
	mu      sync.RWMutex
	maxSize int
}

type cacheEntry struct {
	ips      []string
	expireAt time.Time
}

func newDNSCache(maxSize int) *dnsCache {
	return &dnsCache{
		entries: make(map[string]*cacheEntry),
		maxSize: maxSize,
	}
}

func (c *dnsCache) get(domain string) ([]string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[domain]
	if !ok || time.Now().After(entry.expireAt) {
		return nil, false
	}
	return entry.ips, true
}

func (c *dnsCache) set(domain string, ips []string, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 简单的 LRU：超过上限时清理过期条目
	if len(c.entries) >= c.maxSize {
		c.evictExpired()
	}

	c.entries[domain] = &cacheEntry{
		ips:      ips,
		expireAt: time.Now().Add(ttl),
	}
}

func (c *dnsCache) evictExpired() {
	now := time.Now()
	for k, v := range c.entries {
		if now.After(v.expireAt) {
			delete(c.entries, k)
		}
	}
}

func (c *dnsCache) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]*cacheEntry)
}
