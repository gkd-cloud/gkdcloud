package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type Config struct {
	// 运行模式: "master"（管理面板）或 "node"（JA3 反代节点）
	Mode string `json:"mode"`
	// 订阅域名（用于 Let's Encrypt 证书申请, node 模式必填）
	Domain string `json:"domain"`
	// 上游 SSPanel 地址（node 模式必填）
	Upstream string `json:"upstream"`
	// HTTPS 监听地址（node 模式使用）
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

	// --- Node 模式专用 ---
	// Master 服务器地址（如 https://master.example.com:8443）
	MasterURL string `json:"master_url"`
	// 节点认证令牌（与 master 通信时使用）
	NodeToken string `json:"node_token"`
	// 节点名称（标识当前节点）
	NodeName string `json:"node_name"`
	// 上报间隔（秒），默认 60
	ReportInterval int `json:"report_interval"`

	mu sync.RWMutex `json:"-"`
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	cfg := &Config{
		Mode:           "node",
		ListenHTTPS:    ":443",
		ListenAdmin:    ":8443",
		DataDir:        "/data",
		LogEnabled:     true,
		ReportInterval: 60,
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	// 通用校验
	if cfg.Mode != "master" && cfg.Mode != "node" {
		return nil, fmt.Errorf("mode 必须为 \"master\" 或 \"node\"，当前: %s", cfg.Mode)
	}
	if cfg.AdminPassword == "" {
		return nil, fmt.Errorf("admin_password 不能为空")
	}

	// Node 模式校验
	if cfg.Mode == "node" {
		if cfg.Domain == "" {
			return nil, fmt.Errorf("node 模式下 domain 不能为空")
		}
		if cfg.Upstream == "" {
			return nil, fmt.Errorf("node 模式下 upstream 不能为空")
		}
		if cfg.GuardSecret == "" {
			return nil, fmt.Errorf("node 模式下 guard_secret 不能为空")
		}
	}

	// Master 模式校验
	if cfg.Mode == "master" {
		if cfg.GuardSecret == "" {
			cfg.GuardSecret = "master-default"
		}
	}

	return cfg, nil
}

// IsMaster 返回是否为 master 模式
func (c *Config) IsMaster() bool {
	return c.Mode == "master"
}

// IsNode 返回是否为 node 模式
func (c *Config) IsNode() bool {
	return c.Mode == "node"
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
