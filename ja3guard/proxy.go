package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

type contextKey string

const ctxKeyJA3 contextKey = "ja3hash"

// NewProxyHandler 创建反向代理 handler
// 职责: 剥离客户端伪造的 header → 查白名单 → 记日志 → 注入信任 header → 转发上游
func NewProxyHandler(cfg *Config, store *Store) http.Handler {
	upstream, err := url.Parse(cfg.Upstream)
	if err != nil {
		log.Fatalf("无效的 upstream URL: %v", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(upstream)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		// 保留原始 Host
		originalHost := req.Host
		originalDirector(req)
		req.Host = originalHost

		// 剥离客户端可能伪造的安全 header
		req.Header.Del("X-JA3-Trusted")
		req.Header.Del("X-JA3-Hash")
		req.Header.Del("X-Guard-Secret")

		// 从 context 获取 JA3 hash（由 JA3Listener + ConnContext 注入）
		ja3Hash := ""
		if v := req.Context().Value(ctxKeyJA3); v != nil {
			ja3Hash = v.(string)
		}

		// 查白名单
		trusted := store.IsWhitelisted(ja3Hash)

		// 提取客户端真实 IP
		clientIP := req.RemoteAddr
		if idx := strings.LastIndex(clientIP, ":"); idx != -1 {
			clientIP = clientIP[:idx]
		}

		// 注入标准反向代理 header（供上游 Laravel/PHP 正确识别协议和客户端 IP）
		req.Header.Set("X-Forwarded-Proto", "https")
		req.Header.Set("X-Real-IP", clientIP)
		req.Header.Set("X-Forwarded-Host", req.Host)

		// 记录日志（受配置控制）
		if cfg.GetLogEnabled() {
			store.LogRequest(clientIP, ja3Hash, req.UserAgent(), trusted)
		}

		// 注入信任 header 供上游 PHP 判断
		req.Header.Set("X-JA3-Hash", ja3Hash)
		if trusted {
			req.Header.Set("X-JA3-Trusted", "1")
		} else {
			req.Header.Set("X-JA3-Trusted", "0")
		}
		req.Header.Set("X-Guard-Secret", cfg.GuardSecret)
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
		log.Printf("[Proxy] 上游错误 %s: %v", req.URL, err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
	}

	return proxy
}
