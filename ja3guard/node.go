package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// NodeInfo 子节点信息
type NodeInfo struct {
	ID        string `json:"id"`         // 唯一标识（自动生成）
	Name      string `json:"name"`       // 节点名称
	Host      string `json:"host"`       // 节点 IP 或域名
	SSHPort   int    `json:"ssh_port"`   // SSH 端口
	SSHUser   string `json:"ssh_user"`   // SSH 用户名
	AuthType  string `json:"auth_type"`  // "key" 或 "password"
	SSHKey    string `json:"ssh_key"`    // SSH 私钥内容（auth_type=key 时）
	SSHPass   string `json:"ssh_pass"`   // SSH 密码（auth_type=password 时）
	Token     string `json:"token"`      // 节点上报令牌
	CreatedAt string `json:"created_at"` // 创建时间
	Note      string `json:"note"`       // 备注
}

// NodeStatus 节点运行状态（由节点上报）
type NodeStatus struct {
	NodeID        string `json:"node_id"`
	Online        bool   `json:"online"`
	LastHeartbeat string `json:"last_heartbeat"`
	Version       string `json:"version"`
	Uptime        int64  `json:"uptime"`        // 运行秒数
	TotalRequests int    `json:"total_requests"` // 总请求数
	TrustedCount  int    `json:"trusted_count"`  // 信任请求数
	BlockedCount  int    `json:"blocked_count"`  // 拦截请求数
	Domain        string `json:"domain"`         // 节点域名
	Upstream      string `json:"upstream"`       // 节点上游
}

// NodeStore 管理子节点的存储
type NodeStore struct {
	dataDir  string
	nodes    []NodeInfo
	statuses map[string]*NodeStatus // nodeID -> status
	mu       sync.RWMutex
}

func NewNodeStore(dataDir string) (*NodeStore, error) {
	ns := &NodeStore{
		dataDir:  dataDir,
		statuses: make(map[string]*NodeStatus),
	}
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	ns.loadNodes()
	return ns, nil
}

func (ns *NodeStore) nodesPath() string {
	return filepath.Join(ns.dataDir, "nodes.json")
}

func (ns *NodeStore) loadNodes() {
	data, err := os.ReadFile(ns.nodesPath())
	if err != nil {
		return
	}
	var nodes []NodeInfo
	if json.Unmarshal(data, &nodes) != nil {
		return
	}
	ns.mu.Lock()
	defer ns.mu.Unlock()
	ns.nodes = nodes
}

func (ns *NodeStore) saveNodes() error {
	data, err := json.MarshalIndent(ns.nodes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ns.nodesPath(), data, 0600) // 0600: 含敏感信息
}

// generateID 生成简单的节点 ID
func generateID() string {
	return fmt.Sprintf("node_%d", time.Now().UnixNano())
}

// AddNode 添加子节点
func (ns *NodeStore) AddNode(node NodeInfo) (string, error) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	if node.Name == "" {
		return "", fmt.Errorf("节点名称不能为空")
	}
	if node.Host == "" {
		return "", fmt.Errorf("节点地址不能为空")
	}

	// 检查名称唯一
	for _, n := range ns.nodes {
		if n.Name == node.Name {
			return "", fmt.Errorf("节点名称已存在: %s", node.Name)
		}
	}

	node.ID = generateID()
	if node.SSHPort == 0 {
		node.SSHPort = 22
	}
	if node.SSHUser == "" {
		node.SSHUser = "root"
	}
	if node.AuthType == "" {
		node.AuthType = "password"
	}
	if node.Token == "" {
		node.Token = fmt.Sprintf("tk_%d", time.Now().UnixNano())
	}
	node.CreatedAt = time.Now().Format("2006-01-02 15:04:05")

	ns.nodes = append(ns.nodes, node)
	return node.ID, ns.saveNodes()
}

// UpdateNode 更新节点信息
func (ns *NodeStore) UpdateNode(id string, updated NodeInfo) error {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	for i, n := range ns.nodes {
		if n.ID == id {
			// 保留不可变字段
			updated.ID = n.ID
			updated.CreatedAt = n.CreatedAt
			if updated.Token == "" {
				updated.Token = n.Token
			}
			if updated.SSHPort == 0 {
				updated.SSHPort = n.SSHPort
			}
			ns.nodes[i] = updated
			return ns.saveNodes()
		}
	}
	return fmt.Errorf("节点不存在: %s", id)
}

// RemoveNode 删除节点
func (ns *NodeStore) RemoveNode(id string) error {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	filtered := ns.nodes[:0]
	found := false
	for _, n := range ns.nodes {
		if n.ID == id {
			found = true
			continue
		}
		filtered = append(filtered, n)
	}
	if !found {
		return fmt.Errorf("节点不存在: %s", id)
	}
	ns.nodes = filtered
	delete(ns.statuses, id)
	return ns.saveNodes()
}

// GetNode 获取单个节点
func (ns *NodeStore) GetNode(id string) (*NodeInfo, error) {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	for _, n := range ns.nodes {
		if n.ID == id {
			c := n
			return &c, nil
		}
	}
	return nil, fmt.Errorf("节点不存在: %s", id)
}

// GetNodeByToken 通过 token 查找节点
func (ns *NodeStore) GetNodeByToken(token string) (*NodeInfo, error) {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	for _, n := range ns.nodes {
		if n.Token == token {
			c := n
			return &c, nil
		}
	}
	return nil, fmt.Errorf("无效的节点令牌")
}

// ListNodes 列出所有节点（隐藏敏感信息）
func (ns *NodeStore) ListNodes() []map[string]interface{} {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(ns.nodes))
	for _, n := range ns.nodes {
		status := ns.statuses[n.ID]
		online := false
		lastHB := ""
		if status != nil {
			online = status.Online
			lastHB = status.LastHeartbeat
		}

		result = append(result, map[string]interface{}{
			"id":             n.ID,
			"name":           n.Name,
			"host":           n.Host,
			"ssh_port":       n.SSHPort,
			"ssh_user":       n.SSHUser,
			"auth_type":      n.AuthType,
			"token":          n.Token,
			"created_at":     n.CreatedAt,
			"note":           n.Note,
			"online":         online,
			"last_heartbeat": lastHB,
			"status":         status,
		})
	}
	return result
}

// UpdateStatus 更新节点运行状态（由节点上报调用）
func (ns *NodeStore) UpdateStatus(nodeID string, status *NodeStatus) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	status.NodeID = nodeID
	status.Online = true
	status.LastHeartbeat = time.Now().Format("2006-01-02 15:04:05")
	ns.statuses[nodeID] = status
}

// CheckOffline 检查超时未上报的节点标记为离线
func (ns *NodeStore) CheckOffline(timeoutSeconds int) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	cutoff := time.Now().Add(-time.Duration(timeoutSeconds) * time.Second)
	for id, status := range ns.statuses {
		if status.LastHeartbeat != "" {
			if t, err := time.Parse("2006-01-02 15:04:05", status.LastHeartbeat); err == nil {
				if t.Before(cutoff) {
					ns.statuses[id].Online = false
				}
			}
		}
	}
}
