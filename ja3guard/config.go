package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type Config struct {
	// 订阅域名（用于 Let's Encrypt 证书申请）
	Domain string `json:"domain"`
	// 上游 SSPanel 地址
	Upstream string `json:"upstream"`
	// HTTPS 监听地址
	ListenHTTPS string `json:"listen_https"`
	// 管理面板监听地址
	ListenAdmin string `json:"listen_admin"`
	// 管理面板密码
	AdminPassword string `json:"admin_password"`
	// 共享密钥（防止绕过 JA3 Guard 直接请求上游伪造 header）
	GuardSecret string `json:"guard_secret"`
	// ACME 邮箱
	ACMEEmail string `json:"acme_email"`
	// 数据目录（存放证书、白名单、日志）
	DataDir string `json:"data_dir"`
	// 是否记录请求日志
	LogEnabled bool `json:"log_enabled"`

	mu sync.RWMutex `json:"-"`
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	cfg := &Config{
		ListenHTTPS: ":443",
		ListenAdmin: ":8443",
		DataDir:     "/data",
		LogEnabled:  true,
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	if cfg.Domain == "" {
		return nil, fmt.Errorf("domain 不能为空")
	}
	if cfg.Upstream == "" {
		return nil, fmt.Errorf("upstream 不能为空")
	}
	if cfg.AdminPassword == "" {
		return nil, fmt.Errorf("admin_password 不能为空")
	}
	if cfg.GuardSecret == "" {
		return nil, fmt.Errorf("guard_secret 不能为空")
	}

	return cfg, nil
}

func (c *Config) GetLogEnabled() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.LogEnabled
}

func (c *Config) SetLogEnabled(v bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.LogEnabled = v
}
