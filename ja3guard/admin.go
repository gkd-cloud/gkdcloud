package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
)

//go:embed web/admin.html
var adminFS embed.FS

//go:embed install.sh
var installScript string

type AdminHandler struct {
	cfg       *Config
	store     *Store
	nodeStore *NodeStore
	nginx     *NginxManager
	tmpl      *template.Template
}

func NewAdminHandler(cfg *Config, store *Store, nodeStore *NodeStore) *AdminHandler {
	tmpl := template.Must(template.ParseFS(adminFS, "web/admin.html"))
	return &AdminHandler{cfg: cfg, store: store, nodeStore: nodeStore, nginx: NewNginxManager(), tmpl: tmpl}
}

func (h *AdminHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")

	// 节点上报接口 —— 使用 Token 认证，不需要 Basic Auth
	if path == "api/report" && r.Method == http.MethodPost {
		h.handleNodeReport(w, r)
		return
	}
	// 节点拉取白名单接口 —— Token 认证
	if path == "api/node/whitelist" && r.Method == http.MethodGet {
		h.handleNodeWhitelistPull(w, r)
		return
	}

	// Basic Auth（管理面板）
	_, pass, ok := r.BasicAuth()
	if !ok || pass != h.cfg.AdminPassword {
		w.Header().Set("WWW-Authenticate", `Basic realm="JA3 Guard"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	switch {
	case path == "" || path == "/":
		h.tmpl.Execute(w, nil)
	case path == "api/stats":
		h.handleStats(w, r)
	case path == "api/logs":
		h.handleLogs(w, r)
	case path == "api/logs/summary":
		h.handleLogSummary(w, r)
	case path == "api/whitelist" && r.Method == http.MethodGet:
		h.handleWhitelistGet(w, r)
	case path == "api/whitelist" && r.Method == http.MethodPost:
		h.handleWhitelistAdd(w, r)
	case strings.HasPrefix(path, "api/whitelist/") && r.Method == http.MethodDelete:
		hash := strings.TrimPrefix(path, "api/whitelist/")
		h.handleWhitelistDelete(w, r, hash)
	case path == "api/settings" && r.Method == http.MethodGet:
		h.handleSettingsGet(w, r)
	case path == "api/settings" && r.Method == http.MethodPost:
		h.handleSettingsUpdate(w, r)
	case path == "api/logs/cleanup" && r.Method == http.MethodPost:
		h.handleCleanup(w, r)
	case path == "api/whitelist/sync" && r.Method == http.MethodPost:
		h.handleWhitelistSync(w, r)
	// --- 节点管理 (Master) ---
	case path == "api/nodes" && r.Method == http.MethodGet:
		h.handleNodeList(w, r)
	case path == "api/nodes" && r.Method == http.MethodPost:
		h.handleNodeAdd(w, r)
	case strings.HasPrefix(path, "api/nodes/") && r.Method == http.MethodGet:
		id := strings.TrimPrefix(path, "api/nodes/")
		h.handleNodeGet(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && r.Method == http.MethodPut:
		id := strings.TrimPrefix(path, "api/nodes/")
		h.handleNodeUpdate(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && strings.HasSuffix(path, "/config/push") && r.Method == http.MethodPost:
		id := strings.TrimPrefix(path, "api/nodes/")
		id = strings.TrimSuffix(id, "/config/push")
		h.handleNodeConfigPush(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && strings.HasSuffix(path, "/deploy") && r.Method == http.MethodPost:
		id := strings.TrimPrefix(path, "api/nodes/")
		id = strings.TrimSuffix(id, "/deploy")
		h.handleNodeDeploy(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && strings.HasSuffix(path, "/whitelist/sync") && r.Method == http.MethodPost:
		id := strings.TrimPrefix(path, "api/nodes/")
		id = strings.TrimSuffix(id, "/whitelist/sync")
		h.handleNodeWhitelistSync(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && strings.HasSuffix(path, "/ssh/test") && r.Method == http.MethodPost:
		id := strings.TrimPrefix(path, "api/nodes/")
		id = strings.TrimSuffix(id, "/ssh/test")
		h.handleNodeSSHTest(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && strings.HasSuffix(path, "/ssh/exec") && r.Method == http.MethodPost:
		id := strings.TrimPrefix(path, "api/nodes/")
		id = strings.TrimSuffix(id, "/ssh/exec")
		h.handleNodeSSHExec(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && strings.HasSuffix(path, "/ssh/info") && r.Method == http.MethodGet:
		id := strings.TrimPrefix(path, "api/nodes/")
		id = strings.TrimSuffix(id, "/ssh/info")
		h.handleNodeSSHInfo(w, r, id)
	case strings.HasPrefix(path, "api/nodes/") && r.Method == http.MethodDelete:
		id := strings.TrimPrefix(path, "api/nodes/")
		h.handleNodeDelete(w, r, id)
	// --- Nginx 管理 ---
	case path == "api/nginx/status":
		h.handleNginxStatus(w, r)
	case path == "api/nginx/sites" && r.Method == http.MethodGet:
		h.handleNginxList(w, r)
	case path == "api/nginx/sites" && r.Method == http.MethodPost:
		h.handleNginxSave(w, r)
	case path == "api/nginx/test" && r.Method == http.MethodPost:
		h.handleNginxTest(w, r)
	case path == "api/nginx/reload" && r.Method == http.MethodPost:
		h.handleNginxReload(w, r)
	case strings.HasPrefix(path, "api/nginx/sites/") && strings.HasSuffix(path, "/toggle") && r.Method == http.MethodPost:
		name := strings.TrimPrefix(path, "api/nginx/sites/")
		name = strings.TrimSuffix(name, "/toggle")
		h.handleNginxToggle(w, r, name)
	case strings.HasPrefix(path, "api/nginx/sites/") && r.Method == http.MethodGet:
		name := strings.TrimPrefix(path, "api/nginx/sites/")
		h.handleNginxGet(w, r, name)
	case strings.HasPrefix(path, "api/nginx/sites/") && r.Method == http.MethodDelete:
		name := strings.TrimPrefix(path, "api/nginx/sites/")
		h.handleNginxDelete(w, r, name)
	default:
		http.NotFound(w, r)
	}
}

func (h *AdminHandler) jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (h *AdminHandler) jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// --- API Handlers ---

func (h *AdminHandler) handleStats(w http.ResponseWriter, r *http.Request) {
	h.jsonOK(w, h.store.GetStats())
}

func (h *AdminHandler) handleLogs(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if size < 1 || size > 200 {
		size = 50
	}

	logs, total := h.store.GetLogs(page, size)
	h.jsonOK(w, map[string]interface{}{
		"logs":  logs,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

func (h *AdminHandler) handleLogSummary(w http.ResponseWriter, r *http.Request) {
	h.jsonOK(w, map[string]interface{}{
		"summaries": h.store.GetJA3Summary(),
	})
}

func (h *AdminHandler) handleWhitelistGet(w http.ResponseWriter, r *http.Request) {
	h.jsonOK(w, map[string]interface{}{
		"entries": h.store.GetWhitelist(),
	})
}

func (h *AdminHandler) handleWhitelistAdd(w http.ResponseWriter, r *http.Request) {
	var req struct {
		JA3Hash string `json:"ja3_hash"`
		Note    string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	if req.JA3Hash == "" {
		h.jsonErr(w, "ja3_hash 不能为空", 400)
		return
	}
	if err := h.store.AddWhitelist(req.JA3Hash, req.Note); err != nil {
		h.jsonErr(w, err.Error(), 500)
		return
	}
	h.jsonOK(w, map[string]string{"status": "ok"})
}

func (h *AdminHandler) handleWhitelistDelete(w http.ResponseWriter, r *http.Request, hash string) {
	if err := h.store.RemoveWhitelist(hash); err != nil {
		h.jsonErr(w, err.Error(), 500)
		return
	}
	h.jsonOK(w, map[string]string{"status": "ok"})
}

func (h *AdminHandler) handleSettingsGet(w http.ResponseWriter, r *http.Request) {
	h.jsonOK(w, map[string]interface{}{
		"mode":        h.cfg.Mode,
		"log_enabled": h.cfg.GetLogEnabled(),
		"upstream":    h.cfg.Upstream,
		"domain":      h.cfg.Domain,
	})
}

func (h *AdminHandler) handleSettingsUpdate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		LogEnabled *bool `json:"log_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	if req.LogEnabled != nil {
		h.cfg.SetLogEnabled(*req.LogEnabled)
	}
	h.jsonOK(w, map[string]string{"status": "ok"})
}

func (h *AdminHandler) handleCleanup(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days < 1 {
		days = 30
	}
	h.store.Cleanup(days)
	h.jsonOK(w, map[string]string{"status": "ok"})
}

// handleWhitelistSync 将白名单推送到所有在线节点（通过 SSH 写入）
func (h *AdminHandler) handleWhitelistSync(w http.ResponseWriter, r *http.Request) {
	if h.nodeStore == nil {
		h.jsonErr(w, "仅在 master 模式下可用", 400)
		return
	}

	whitelist := h.store.GetWhitelist()
	wlJSON, _ := json.MarshalIndent(whitelist, "", "  ")

	nodes := h.nodeStore.ListNodes()
	results := make([]map[string]interface{}, 0, len(nodes))

	for _, n := range nodes {
		nodeID, _ := n["id"].(string)
		nodeName, _ := n["name"].(string)

		node, err := h.nodeStore.GetNode(nodeID)
		if err != nil {
			results = append(results, map[string]interface{}{
				"name": nodeName, "ok": false, "error": err.Error(),
			})
			continue
		}

		client := NewSSHClient(node)
		// 将白名单写入节点的数据目录
		cmd := fmt.Sprintf("mkdir -p /opt/ja3guard/data && cat > /opt/ja3guard/data/whitelist.json << 'WLEOF'\n%s\nWLEOF", string(wlJSON))
		_, err = client.Exec(cmd)
		if err != nil {
			results = append(results, map[string]interface{}{
				"name": nodeName, "ok": false, "error": err.Error(),
			})
			continue
		}

		results = append(results, map[string]interface{}{
			"name": nodeName, "ok": true,
		})
		log.Printf("[Sync] 白名单已推送到 %s", nodeName)
	}

	h.jsonOK(w, map[string]interface{}{
		"status":  "ok",
		"results": results,
	})
}

// ============================================================
// 节点管理 API（需要 Basic Auth）
// ============================================================

func (h *AdminHandler) handleNodeList(w http.ResponseWriter, r *http.Request) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	h.jsonOK(w, map[string]interface{}{
		"nodes": h.nodeStore.ListNodes(),
	})
}

func (h *AdminHandler) handleNodeAdd(w http.ResponseWriter, r *http.Request) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	var node NodeInfo
	if err := json.NewDecoder(r.Body).Decode(&node); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	id, err := h.nodeStore.AddNode(node)
	if err != nil {
		h.jsonErr(w, err.Error(), 400)
		return
	}
	h.jsonOK(w, map[string]string{"status": "ok", "id": id})
}

func (h *AdminHandler) handleNodeGet(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}
	h.jsonOK(w, node)
}

func (h *AdminHandler) handleNodeUpdate(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	var node NodeInfo
	if err := json.NewDecoder(r.Body).Decode(&node); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	if err := h.nodeStore.UpdateNode(id, node); err != nil {
		h.jsonErr(w, err.Error(), 400)
		return
	}
	h.jsonOK(w, map[string]string{"status": "ok"})
}

func (h *AdminHandler) handleNodeDelete(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	if err := h.nodeStore.RemoveNode(id); err != nil {
		h.jsonErr(w, err.Error(), 400)
		return
	}
	h.jsonOK(w, map[string]string{"status": "ok"})
}

// ============================================================
// SSH 远程操作 API
// ============================================================

func (h *AdminHandler) handleNodeSSHTest(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}

	client := NewSSHClient(node)
	if err := client.TestConnection(); err != nil {
		h.jsonOK(w, map[string]interface{}{
			"ok":    false,
			"error": err.Error(),
		})
		return
	}
	h.jsonOK(w, map[string]interface{}{
		"ok":      true,
		"message": "SSH 连接成功",
	})
}

func (h *AdminHandler) handleNodeSSHExec(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}

	var req struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	if req.Command == "" {
		h.jsonErr(w, "命令不能为空", 400)
		return
	}

	client := NewSSHClient(node)
	output, err := client.Exec(req.Command)
	if err != nil {
		h.jsonOK(w, map[string]interface{}{
			"ok":     false,
			"output": err.Error(),
		})
		return
	}
	h.jsonOK(w, map[string]interface{}{
		"ok":     true,
		"output": output,
	})
}

func (h *AdminHandler) handleNodeSSHInfo(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "节点管理仅在 master 模式下可用", 400)
		return
	}
	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}

	client := NewSSHClient(node)
	info, err := client.GetSystemInfo()
	if err != nil {
		h.jsonErr(w, err.Error(), 500)
		return
	}
	h.jsonOK(w, info)
}

// ============================================================
// 节点上报 API（Token 认证，无需 Basic Auth）
// ============================================================

func (h *AdminHandler) handleNodeReport(w http.ResponseWriter, r *http.Request) {
	if h.nodeStore == nil {
		h.jsonErr(w, "上报仅在 master 模式下可用", 400)
		return
	}

	// Token 认证: Authorization: Bearer <token>
	token := r.Header.Get("Authorization")
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		h.jsonErr(w, "缺少认证令牌", 401)
		return
	}

	node, err := h.nodeStore.GetNodeByToken(token)
	if err != nil {
		h.jsonErr(w, "无效的认证令牌", 401)
		return
	}

	var report struct {
		Version       string     `json:"version"`
		Uptime        int64      `json:"uptime"`
		TotalRequests int        `json:"total_requests"`
		TrustedCount  int        `json:"trusted_count"`
		BlockedCount  int        `json:"blocked_count"`
		Domain        string     `json:"domain"`
		Upstream      string     `json:"upstream"`
		Logs          []LogEntry `json:"logs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}

	// 更新节点状态
	h.nodeStore.UpdateStatus(node.ID, &NodeStatus{
		Version:       report.Version,
		Uptime:        report.Uptime,
		TotalRequests: report.TotalRequests,
		TrustedCount:  report.TrustedCount,
		BlockedCount:  report.BlockedCount,
		Domain:        report.Domain,
		Upstream:      report.Upstream,
	})

	// 存储节点上报的日志
	for _, logEntry := range report.Logs {
		h.store.LogRequest(logEntry.IP, logEntry.JA3Hash, logEntry.UA, logEntry.Trusted)
	}

	// 返回白名单给节点同步
	whitelist := h.store.GetWhitelist()
	h.jsonOK(w, map[string]interface{}{
		"status":    "ok",
		"whitelist": whitelist,
	})
}

// ============================================================
// 远程部署 & 配置推送 API
// ============================================================

// generateRandomPassword 生成随机密码
func generateRandomPassword(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return hex.EncodeToString(b)[:length]
}

// handleNodeConfigPush 推送配置到子节点
func (h *AdminHandler) handleNodeConfigPush(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "仅在 master 模式下可用", 400)
		return
	}

	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}

	// 从请求体可选覆盖 domain/upstream/admin_password
	var req struct {
		Domain        string `json:"domain"`
		Upstream      string `json:"upstream"`
		AdminPassword string `json:"admin_password"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	domain := node.Domain
	if req.Domain != "" {
		domain = req.Domain
	}
	upstream := node.Upstream
	if req.Upstream != "" {
		upstream = req.Upstream
	}
	if upstream != "" && !strings.HasPrefix(upstream, "http://") && !strings.HasPrefix(upstream, "https://") {
		upstream = "http://" + upstream
	}

	adminPassword := req.AdminPassword
	if adminPassword == "" {
		adminPassword = generateRandomPassword(20)
	}

	if domain == "" {
		h.jsonErr(w, "domain 不能为空，请在节点信息中填写或在请求中提供", 400)
		return
	}
	if upstream == "" {
		h.jsonErr(w, "upstream 不能为空，请在节点信息中填写或在请求中提供", 400)
		return
	}

	// 构建 Master 地址
	masterURL := fmt.Sprintf("http://%s", r.Host)
	if r.TLS != nil {
		masterURL = fmt.Sprintf("https://%s", r.Host)
	}

	// 生成 config.json
	configJSON := fmt.Sprintf(`{
  "mode": "node",
  "domain": "%s",
  "upstream": "%s",
  "listen_https": ":443",
  "listen_admin": ":8443",
  "admin_password": "%s",
  "guard_secret": "%s",
  "acme_email": "%s",
  "data_dir": "/opt/ja3guard/data",
  "log_enabled": true,
  "master_url": "%s",
  "node_token": "%s",
  "node_name": "%s",
  "report_interval": 60
}`, domain, upstream, adminPassword, h.cfg.GuardSecret, h.cfg.ACMEEmail, masterURL, node.Token, node.Name)

	// 通过 SSH 写入配置
	client := NewSSHClient(node)
	if err := client.WriteFile(configJSON, "/opt/ja3guard/data/config.json"); err != nil {
		h.jsonErr(w, "推送配置失败: "+err.Error(), 500)
		return
	}

	// 尝试重启服务（如果已安装）
	restartOutput, _ := client.Exec("systemctl restart ja3guard 2>&1 || echo 'ja3guard 服务未安装，跳过重启'")

	log.Printf("[ConfigPush] 配置已推送到 %s (%s)", node.Name, node.Host)

	h.jsonOK(w, map[string]interface{}{
		"status":         "ok",
		"admin_password": adminPassword,
		"restart_output": restartOutput,
		"message":        fmt.Sprintf("配置已推送到 %s", node.Name),
	})
}

// handleNodeDeploy 远程部署子节点
func (h *AdminHandler) handleNodeDeploy(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "仅在 master 模式下可用", 400)
		return
	}

	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}

	// 从请求体获取部署参数
	var req struct {
		Domain        string `json:"domain"`
		Upstream      string `json:"upstream"`
		SkipNginx     bool   `json:"skip_nginx"`
		AdminPassword string `json:"admin_password"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	domain := req.Domain
	if domain == "" {
		domain = node.Domain
	}
	upstream := req.Upstream
	if upstream == "" {
		upstream = node.Upstream
	}
	adminPassword := req.AdminPassword
	if adminPassword == "" {
		adminPassword = generateRandomPassword(20)
	}

	if domain == "" {
		h.jsonErr(w, "domain 不能为空", 400)
		return
	}

	// 构建 Master 地址
	masterURL := fmt.Sprintf("http://%s", r.Host)
	if r.TLS != nil {
		masterURL = fmt.Sprintf("https://%s", r.Host)
	}

	// 构建环境变量前缀
	envParts := []string{
		"JA3_MODE=node",
		fmt.Sprintf("JA3_DOMAIN=%s", domain),
		fmt.Sprintf("JA3_ADMIN_PASSWORD=%s", adminPassword),
		fmt.Sprintf("JA3_MASTER_URL=%s", masterURL),
		fmt.Sprintf("JA3_NODE_TOKEN=%s", node.Token),
		fmt.Sprintf("JA3_NODE_NAME=%s", node.Name),
	}
	if upstream != "" {
		envParts = append(envParts, fmt.Sprintf("JA3_UPSTREAM=%s", upstream))
	}
	if req.SkipNginx {
		envParts = append(envParts, "JA3_SKIP_NGINX=1")
	}
	envPrefix := strings.Join(envParts, " ")

	// 通过 SSH 上传并执行 install.sh
	client := NewSSHClient(node)
	output, err := client.UploadAndRun(installScript, "/tmp/ja3guard-install.sh", envPrefix)
	if err != nil {
		h.jsonOK(w, map[string]interface{}{
			"ok":             false,
			"output":         output,
			"error":          err.Error(),
			"admin_password": adminPassword,
		})
		return
	}

	log.Printf("[Deploy] 节点 %s (%s) 部署完成", node.Name, node.Host)

	h.jsonOK(w, map[string]interface{}{
		"ok":             true,
		"output":         output,
		"admin_password": adminPassword,
		"message":        fmt.Sprintf("节点 %s 部署完成", node.Name),
	})
}

// handleNodeWhitelistSync 推送白名单到单个节点
func (h *AdminHandler) handleNodeWhitelistSync(w http.ResponseWriter, r *http.Request, id string) {
	if h.nodeStore == nil {
		h.jsonErr(w, "仅在 master 模式下可用", 400)
		return
	}

	node, err := h.nodeStore.GetNode(id)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}

	whitelist := h.store.GetWhitelist()
	wlJSON, _ := json.MarshalIndent(whitelist, "", "  ")

	client := NewSSHClient(node)
	if err := client.WriteFile(string(wlJSON), "/opt/ja3guard/data/whitelist.json"); err != nil {
		h.jsonOK(w, map[string]interface{}{
			"ok":    false,
			"error": err.Error(),
		})
		return
	}

	log.Printf("[Sync] 白名单已推送到 %s", node.Name)

	h.jsonOK(w, map[string]interface{}{
		"ok":      true,
		"message": fmt.Sprintf("白名单已推送到 %s", node.Name),
	})
}

// handleNodeWhitelistPull 节点主动拉取白名单
func (h *AdminHandler) handleNodeWhitelistPull(w http.ResponseWriter, r *http.Request) {
	if h.nodeStore == nil {
		h.jsonErr(w, "仅在 master 模式下可用", 400)
		return
	}

	token := r.Header.Get("Authorization")
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		h.jsonErr(w, "缺少认证令牌", 401)
		return
	}

	if _, err := h.nodeStore.GetNodeByToken(token); err != nil {
		h.jsonErr(w, "无效的认证令牌", 401)
		return
	}

	h.jsonOK(w, map[string]interface{}{
		"whitelist": h.store.GetWhitelist(),
	})
}
