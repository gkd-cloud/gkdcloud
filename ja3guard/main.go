package main

import (
	"context"
	"crypto/tls"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"golang.org/x/crypto/acme/autocert"
)

func main() {
	configPath := flag.String("config", "/data/config.json", "配置文件路径")
	flag.Parse()

	// 加载配置
	cfg, err := LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 初始化存储
	store, err := NewStore(cfg.DataDir)
	if err != nil {
		log.Fatalf("初始化存储失败: %v", err)
	}

	// 定时清理旧日志（保留 30 天）
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			store.Cleanup(30)
			log.Println("[Store] 已清理 30 天前的日志")
		}
	}()

	// --- ACME 证书管理 ---
	certDir := filepath.Join(cfg.DataDir, "certs")
	os.MkdirAll(certDir, 0700)

	manager := &autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		HostPolicy: autocert.HostWhitelist(cfg.Domain),
		Cache:      autocert.DirCache(certDir),
		Email:      cfg.ACMEEmail,
	}

	// --- JA3 提取层 ---
	ja3Map := &sync.Map{}

	// TLS 配置（使用 ACME 自动证书）
	tlsConfig := manager.TLSConfig()
	tlsConfig.MinVersion = tls.VersionTLS12

	// TCP 监听
	tcpListener, err := net.Listen("tcp", cfg.ListenHTTPS)
	if err != nil {
		log.Fatalf("监听 %s 失败: %v", cfg.ListenHTTPS, err)
	}

	// 包装: TCP → JA3 提取 → TLS
	ja3Listener := &JA3Listener{inner: tcpListener, JA3Map: ja3Map}
	tlsListener := tls.NewListener(ja3Listener, tlsConfig)

	// --- 反向代理 ---
	proxyHandler := NewProxyHandler(cfg, store)

	httpsServer := &http.Server{
		Handler:      proxyHandler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
		ConnContext: func(ctx context.Context, c net.Conn) context.Context {
			// 从 JA3Listener 的 map 中取出该连接的 JA3 hash
			addr := c.RemoteAddr().String()
			if hash, ok := ja3Map.LoadAndDelete(addr); ok {
				return context.WithValue(ctx, ctxKeyJA3, hash.(string))
			}
			return ctx
		},
	}

	// --- 管理面板 ---
	adminHandler := NewAdminHandler(cfg, store)
	adminServer := &http.Server{
		Addr:         cfg.ListenAdmin,
		Handler:      adminHandler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// --- HTTP 服务（ACME HTTP-01 验证 + HTTPS 重定向）---
	httpServer := &http.Server{
		Addr:    ":80",
		Handler: manager.HTTPHandler(http.HandlerFunc(httpRedirect)),
	}

	// 启动所有服务
	go func() {
		log.Printf("[HTTPS] 订阅代理启动 %s (域名: %s → 上游: %s)", cfg.ListenHTTPS, cfg.Domain, cfg.Upstream)
		if err := httpsServer.Serve(tlsListener); err != http.ErrServerClosed {
			log.Fatalf("[HTTPS] 服务错误: %v", err)
		}
	}()

	go func() {
		log.Printf("[Admin] 管理面板启动 %s", cfg.ListenAdmin)
		if err := adminServer.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("[Admin] 服务错误: %v", err)
		}
	}()

	go func() {
		log.Printf("[HTTP] ACME 验证 + 重定向启动 :80")
		if err := httpServer.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("[HTTP] 服务错误: %v", err)
		}
	}()

	log.Println("JA3 Guard 已就绪")

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("收到停止信号，正在关闭...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	httpsServer.Shutdown(ctx)
	adminServer.Shutdown(ctx)
	httpServer.Shutdown(ctx)
	log.Println("已安全关闭")
}

func httpRedirect(w http.ResponseWriter, r *http.Request) {
	target := "https://" + r.Host + r.URL.RequestURI()
	http.Redirect(w, r, target, http.StatusMovedPermanently)
}
