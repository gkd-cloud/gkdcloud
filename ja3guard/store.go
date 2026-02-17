package main

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// WhitelistEntry 白名单条目
type WhitelistEntry struct {
	JA3Hash   string `json:"ja3_hash"`
	Note      string `json:"note"`
	CreatedAt string `json:"created_at"`
}

// LogEntry 请求日志条目（JSONL 格式存储）
type LogEntry struct {
	Timestamp string `json:"ts"`
	IP        string `json:"ip"`
	JA3Hash   string `json:"ja3"`
	UA        string `json:"ua"`
	Trusted   bool   `json:"ok"`
}

// JA3Summary 按 JA3 hash 聚合的统计
type JA3Summary struct {
	JA3Hash     string `json:"ja3_hash"`
	Count       int    `json:"count"`
	LastUA      string `json:"last_ua"`
	LastIP      string `json:"last_ip"`
	LastSeen    string `json:"last_seen"`
	InWhitelist bool   `json:"in_whitelist"`
}

// Stats 总体统计
type Stats struct {
	TotalRequests int `json:"total_requests"`
	TrustedCount  int `json:"trusted_count"`
	BlockedCount  int `json:"blocked_count"`
}

// Store 管理白名单和请求日志
// 白名单: JSON 文件 (data/whitelist.json)
// 日志:   JSONL 文件 (data/ja3_logs.jsonl)
type Store struct {
	dataDir   string
	whitelist []WhitelistEntry
	wlIndex   map[string]bool // 快速查找
	mu        sync.RWMutex
}

func NewStore(dataDir string) (*Store, error) {
	s := &Store{
		dataDir: dataDir,
		wlIndex: make(map[string]bool),
	}
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s.loadWhitelist()
	return s, nil
}

func (s *Store) whitelistPath() string {
	return filepath.Join(s.dataDir, "whitelist.json")
}

func (s *Store) logPath() string {
	return filepath.Join(s.dataDir, "ja3_logs.jsonl")
}

// --- 白名单操作 ---

func (s *Store) loadWhitelist() {
	data, err := os.ReadFile(s.whitelistPath())
	if err != nil {
		return
	}
	var entries []WhitelistEntry
	if json.Unmarshal(data, &entries) != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.whitelist = entries
	s.wlIndex = make(map[string]bool, len(entries))
	for _, e := range entries {
		s.wlIndex[e.JA3Hash] = true
	}
}

func (s *Store) saveWhitelist() error {
	data, err := json.MarshalIndent(s.whitelist, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.whitelistPath(), data, 0644)
}

func (s *Store) IsWhitelisted(hash string) bool {
	if hash == "" {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.wlIndex[hash]
}

func (s *Store) AddWhitelist(hash, note string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.wlIndex[hash] {
		for i := range s.whitelist {
			if s.whitelist[i].JA3Hash == hash {
				s.whitelist[i].Note = note
				break
			}
		}
	} else {
		s.whitelist = append(s.whitelist, WhitelistEntry{
			JA3Hash:   hash,
			Note:      note,
			CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
		})
		s.wlIndex[hash] = true
	}

	return s.saveWhitelist()
}

func (s *Store) RemoveWhitelist(hash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.wlIndex, hash)
	filtered := s.whitelist[:0]
	for _, e := range s.whitelist {
		if e.JA3Hash != hash {
			filtered = append(filtered, e)
		}
	}
	s.whitelist = filtered
	return s.saveWhitelist()
}

func (s *Store) GetWhitelist() []WhitelistEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]WhitelistEntry, len(s.whitelist))
	copy(result, s.whitelist)
	return result
}

// --- 日志操作 ---

// LogRequest 追加一条请求日志（JSONL 格式，O_APPEND 原子写入）
func (s *Store) LogRequest(ip, ja3Hash, ua string, trusted bool) {
	entry := LogEntry{
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
		IP:        ip,
		JA3Hash:   ja3Hash,
		UA:        ua,
		Trusted:   trusted,
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return
	}

	f, err := os.OpenFile(s.logPath(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	f.Write(data)
	f.Write([]byte("\n"))
}

// ReadLogs 读取全部日志条目
func (s *Store) ReadLogs() []LogEntry {
	f, err := os.Open(s.logPath())
	if err != nil {
		return nil
	}
	defer f.Close()

	var logs []LogEntry
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 256*1024), 1024*1024)
	for scanner.Scan() {
		var entry LogEntry
		if json.Unmarshal(scanner.Bytes(), &entry) == nil {
			logs = append(logs, entry)
		}
	}
	return logs
}

// GetLogs 分页获取日志（最新在前）
func (s *Store) GetLogs(page, size int) ([]LogEntry, int) {
	logs := s.ReadLogs()
	total := len(logs)

	// 倒序（最新在前）
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}

	start := (page - 1) * size
	if start >= total {
		return nil, total
	}
	end := start + size
	if end > total {
		end = total
	}
	return logs[start:end], total
}

// GetStats 获取总体统计
func (s *Store) GetStats() Stats {
	logs := s.ReadLogs()
	stats := Stats{TotalRequests: len(logs)}
	for _, l := range logs {
		if l.Trusted {
			stats.TrustedCount++
		}
	}
	stats.BlockedCount = stats.TotalRequests - stats.TrustedCount
	return stats
}

// GetJA3Summary 按 JA3 hash 聚合统计
func (s *Store) GetJA3Summary() []JA3Summary {
	logs := s.ReadLogs()

	type info struct {
		count    int
		lastUA   string
		lastIP   string
		lastSeen string
	}
	m := make(map[string]*info)

	for _, l := range logs {
		if _, ok := m[l.JA3Hash]; !ok {
			m[l.JA3Hash] = &info{}
		}
		m[l.JA3Hash].count++
		m[l.JA3Hash].lastUA = l.UA
		m[l.JA3Hash].lastIP = l.IP
		m[l.JA3Hash].lastSeen = l.Timestamp
	}

	summaries := make([]JA3Summary, 0, len(m))
	for hash, info := range m {
		summaries = append(summaries, JA3Summary{
			JA3Hash:     hash,
			Count:       info.count,
			LastUA:      info.lastUA,
			LastIP:      info.lastIP,
			LastSeen:    info.lastSeen,
			InWhitelist: s.IsWhitelisted(hash),
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].Count > summaries[j].Count
	})
	return summaries
}

// Cleanup 清理指定天数前的日志
func (s *Store) Cleanup(keepDays int) {
	logs := s.ReadLogs()
	cutoff := time.Now().AddDate(0, 0, -keepDays).Format("2006-01-02 15:04:05")

	var kept []LogEntry
	for _, l := range logs {
		if l.Timestamp >= cutoff {
			kept = append(kept, l)
		}
	}

	f, err := os.Create(s.logPath())
	if err != nil {
		return
	}
	defer f.Close()

	for _, entry := range kept {
		data, _ := json.Marshal(entry)
		f.Write(data)
		f.Write([]byte("\n"))
	}
}
