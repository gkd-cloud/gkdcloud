package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const Version = "1.0.0"

// Reporter 节点上报客户端
type Reporter struct {
	cfg       *Config
	store     *Store
	client    *http.Client
	startTime time.Time
	lastSent  string // 上次上报的最后一条日志时间戳，避免重复发送
}

func NewReporter(cfg *Config, store *Store) *Reporter {
	return &Reporter{
		cfg:       cfg,
		store:     store,
		startTime: time.Now(),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Start 启动定时上报
func (rp *Reporter) Start() {
	if rp.cfg.MasterURL == "" || rp.cfg.NodeToken == "" {
		log.Println("[Reporter] master_url 或 node_token 未配置，上报功能禁用")
		return
	}

	interval := time.Duration(rp.cfg.ReportInterval) * time.Second
	if interval < 10*time.Second {
		interval = 60 * time.Second
	}

	log.Printf("[Reporter] 上报已启动，间隔 %s，目标: %s", interval, rp.cfg.MasterURL)

	// 首次立即上报
	rp.report()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		rp.report()
	}
}

func (rp *Reporter) report() {
	stats := rp.store.GetStats()

	// 获取新增日志（上次上报之后的）
	newLogs := rp.getNewLogs()

	payload := map[string]interface{}{
		"version":        Version,
		"uptime":         int64(time.Since(rp.startTime).Seconds()),
		"total_requests": stats.TotalRequests,
		"trusted_count":  stats.TrustedCount,
		"blocked_count":  stats.BlockedCount,
		"domain":         rp.cfg.Domain,
		"upstream":       rp.cfg.Upstream,
		"logs":           newLogs,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Reporter] 序列化失败: %v", err)
		return
	}

	url := strings.TrimRight(rp.cfg.MasterURL, "/") + "/api/report"
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		log.Printf("[Reporter] 创建请求失败: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+rp.cfg.NodeToken)

	resp, err := rp.client.Do(req)
	if err != nil {
		log.Printf("[Reporter] 上报失败: %v", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		log.Printf("[Reporter] 上报返回 %d: %s", resp.StatusCode, string(body))
		return
	}

	// 解析返回的白名单并同步
	var result struct {
		Status    string           `json:"status"`
		Whitelist []WhitelistEntry `json:"whitelist"`
	}
	if err := json.Unmarshal(body, &result); err == nil && result.Whitelist != nil {
		rp.syncWhitelist(result.Whitelist)
	}

	if len(newLogs) > 0 {
		log.Printf("[Reporter] 上报成功，发送 %d 条日志", len(newLogs))
	}
}

// getNewLogs 获取上次上报之后新增的日志
func (rp *Reporter) getNewLogs() []LogEntry {
	allLogs := rp.store.ReadLogs()
	if rp.lastSent == "" {
		// 首次上报：只发最近 100 条
		start := len(allLogs) - 100
		if start < 0 {
			start = 0
		}
		result := allLogs[start:]
		if len(allLogs) > 0 {
			rp.lastSent = allLogs[len(allLogs)-1].Timestamp
		}
		return result
	}

	// 找到上次上报位置之后的新日志
	var newLogs []LogEntry
	for _, l := range allLogs {
		if l.Timestamp > rp.lastSent {
			newLogs = append(newLogs, l)
		}
	}
	if len(newLogs) > 0 {
		rp.lastSent = newLogs[len(newLogs)-1].Timestamp
	}

	// 限制单次上报最多 500 条
	if len(newLogs) > 500 {
		newLogs = newLogs[len(newLogs)-500:]
	}
	return newLogs
}

// syncWhitelist 用 master 返回的白名单覆盖本地
func (rp *Reporter) syncWhitelist(masterList []WhitelistEntry) {
	localList := rp.store.GetWhitelist()

	// 构建 master 白名单的 index
	masterIndex := make(map[string]bool, len(masterList))
	for _, e := range masterList {
		masterIndex[e.JA3Hash] = true
	}

	// 构建本地白名单的 index
	localIndex := make(map[string]bool, len(localList))
	for _, e := range localList {
		localIndex[e.JA3Hash] = true
	}

	changed := false

	// 添加 master 有但本地没有的
	for _, e := range masterList {
		if !localIndex[e.JA3Hash] {
			rp.store.AddWhitelist(e.JA3Hash, fmt.Sprintf("[master] %s", e.Note))
			changed = true
		}
	}

	// 删除 master 没有但本地有的
	for _, e := range localList {
		if !masterIndex[e.JA3Hash] {
			rp.store.RemoveWhitelist(e.JA3Hash)
			changed = true
		}
	}

	if changed {
		log.Printf("[Reporter] 白名单已同步，共 %d 条", len(masterList))
	}
}
