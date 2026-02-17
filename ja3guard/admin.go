package main

import (
	"embed"
	"encoding/json"
	"html/template"
	"net/http"
	"strconv"
	"strings"
)

//go:embed web/admin.html
var adminFS embed.FS

type AdminHandler struct {
	cfg   *Config
	store *Store
	nginx *NginxManager
	tmpl  *template.Template
}

func NewAdminHandler(cfg *Config, store *Store) *AdminHandler {
	tmpl := template.Must(template.ParseFS(adminFS, "web/admin.html"))
	return &AdminHandler{cfg: cfg, store: store, nginx: NewNginxManager(), tmpl: tmpl}
}

func (h *AdminHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Basic Auth
	_, pass, ok := r.BasicAuth()
	if !ok || pass != h.cfg.AdminPassword {
		w.Header().Set("WWW-Authenticate", `Basic realm="JA3 Guard"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/")

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
