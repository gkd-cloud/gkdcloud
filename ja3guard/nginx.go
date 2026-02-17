package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// NginxManager 管理 Nginx 站点配置
type NginxManager struct {
	confDir string // /etc/nginx/conf.d 或 /etc/nginx/sites-available
	style   string // "conf.d" 或 "sites"
}

type NginxSite struct {
	Name      string `json:"name"`
	Filename  string `json:"filename"`
	Content   string `json:"content"`
	Enabled   bool   `json:"enabled"`
	UpdatedAt string `json:"updated_at"`
}

type NginxTestResult struct {
	OK     bool   `json:"ok"`
	Output string `json:"output"`
}

var safeNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`)

func NewNginxManager() *NginxManager {
	nm := &NginxManager{}
	if _, err := os.Stat("/etc/nginx/sites-available"); err == nil {
		nm.confDir = "/etc/nginx/sites-available"
		nm.style = "sites"
	} else {
		nm.confDir = "/etc/nginx/conf.d"
		nm.style = "conf.d"
	}
	os.MkdirAll(nm.confDir, 0755)
	return nm
}

// List 列出所有站点配置
func (nm *NginxManager) List() ([]NginxSite, error) {
	entries, err := os.ReadDir(nm.confDir)
	if err != nil {
		return nil, err
	}

	var sites []NginxSite
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		// conf.d 模式只看 .conf 文件
		if nm.style == "conf.d" && !strings.HasSuffix(name, ".conf") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		content, err := os.ReadFile(filepath.Join(nm.confDir, name))
		if err != nil {
			continue
		}

		enabled := true
		if nm.style == "sites" {
			enabledLink := filepath.Join("/etc/nginx/sites-enabled", name)
			if _, err := os.Lstat(enabledLink); os.IsNotExist(err) {
				enabled = false
			}
		}

		sites = append(sites, NginxSite{
			Name:      strings.TrimSuffix(name, ".conf"),
			Filename:  name,
			Content:   string(content),
			Enabled:   enabled,
			UpdatedAt: info.ModTime().Format("2006-01-02 15:04:05"),
		})
	}

	sort.Slice(sites, func(i, j int) bool {
		return sites[i].Name < sites[j].Name
	})
	return sites, nil
}

// Get 获取单个站点配置
func (nm *NginxManager) Get(name string) (*NginxSite, error) {
	if !safeNameRe.MatchString(name) {
		return nil, fmt.Errorf("非法的站点名: %s", name)
	}
	filename := nm.toFilename(name)
	path := filepath.Join(nm.confDir, filename)
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("站点不存在: %s", name)
	}
	info, _ := os.Stat(path)
	enabled := true
	if nm.style == "sites" {
		enabledLink := filepath.Join("/etc/nginx/sites-enabled", filename)
		if _, err := os.Lstat(enabledLink); os.IsNotExist(err) {
			enabled = false
		}
	}
	return &NginxSite{
		Name:      name,
		Filename:  filename,
		Content:   string(content),
		Enabled:   enabled,
		UpdatedAt: info.ModTime().Format("2006-01-02 15:04:05"),
	}, nil
}

// Save 创建或更新站点配置
func (nm *NginxManager) Save(name, content string) error {
	if !safeNameRe.MatchString(name) {
		return fmt.Errorf("非法的站点名，只允许字母数字和 .-_ : %s", name)
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("配置内容不能为空")
	}
	filename := nm.toFilename(name)
	path := filepath.Join(nm.confDir, filename)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return fmt.Errorf("写入失败: %w", err)
	}
	// sites 模式自动启用
	if nm.style == "sites" {
		enabledLink := filepath.Join("/etc/nginx/sites-enabled", filename)
		os.Symlink(path, enabledLink) // 忽略已存在错误
	}
	return nil
}

// Delete 删除站点配置
func (nm *NginxManager) Delete(name string) error {
	if !safeNameRe.MatchString(name) {
		return fmt.Errorf("非法的站点名: %s", name)
	}
	filename := nm.toFilename(name)
	path := filepath.Join(nm.confDir, filename)
	// 先删 sites-enabled 的软链
	if nm.style == "sites" {
		os.Remove(filepath.Join("/etc/nginx/sites-enabled", filename))
	}
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("删除失败: %w", err)
	}
	return nil
}

// SetEnabled 启用/禁用站点（仅 sites 模式有效）
func (nm *NginxManager) SetEnabled(name string, enabled bool) error {
	if nm.style != "sites" {
		return fmt.Errorf("conf.d 模式不支持单独启用/禁用，请删除文件")
	}
	if !safeNameRe.MatchString(name) {
		return fmt.Errorf("非法的站点名: %s", name)
	}
	filename := nm.toFilename(name)
	enabledLink := filepath.Join("/etc/nginx/sites-enabled", filename)
	availablePath := filepath.Join(nm.confDir, filename)

	if enabled {
		os.Remove(enabledLink) // 先删旧的
		return os.Symlink(availablePath, enabledLink)
	}
	return os.Remove(enabledLink)
}

// Test 测试 Nginx 配置
func (nm *NginxManager) Test() NginxTestResult {
	cmd := exec.Command("nginx", "-t")
	output, err := cmd.CombinedOutput()
	return NginxTestResult{
		OK:     err == nil,
		Output: string(output),
	}
}

// Reload 重载 Nginx
func (nm *NginxManager) Reload() error {
	result := nm.Test()
	if !result.OK {
		return fmt.Errorf("配置测试失败: %s", result.Output)
	}
	cmd := exec.Command("systemctl", "reload", "nginx")
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("reload 失败: %s", string(output))
	}
	return nil
}

// Status 获取 Nginx 状态
func (nm *NginxManager) Status() map[string]interface{} {
	info := map[string]interface{}{
		"installed": false,
		"running":   false,
		"version":   "",
		"conf_dir":  nm.confDir,
		"style":     nm.style,
	}

	// 版本
	if out, err := exec.Command("nginx", "-v").CombinedOutput(); err == nil {
		info["installed"] = true
		v := string(out)
		if idx := strings.Index(v, "nginx/"); idx >= 0 {
			info["version"] = strings.TrimSpace(v[idx:])
		}
	}

	// 运行状态
	if err := exec.Command("systemctl", "is-active", "--quiet", "nginx").Run(); err == nil {
		info["running"] = true
	}

	return info
}

func (nm *NginxManager) toFilename(name string) string {
	if nm.style == "conf.d" {
		if strings.HasSuffix(name, ".conf") {
			return name
		}
		return name + ".conf"
	}
	return name
}

// ============================================================
// HTTP Handler 注册
// ============================================================

func (h *AdminHandler) handleNginxStatus(w http.ResponseWriter, r *http.Request) {
	h.jsonOK(w, h.nginx.Status())
}

func (h *AdminHandler) handleNginxList(w http.ResponseWriter, r *http.Request) {
	sites, err := h.nginx.List()
	if err != nil {
		h.jsonErr(w, err.Error(), 500)
		return
	}
	h.jsonOK(w, map[string]interface{}{"sites": sites})
}

func (h *AdminHandler) handleNginxGet(w http.ResponseWriter, r *http.Request, name string) {
	site, err := h.nginx.Get(name)
	if err != nil {
		h.jsonErr(w, err.Error(), 404)
		return
	}
	h.jsonOK(w, site)
}

func (h *AdminHandler) handleNginxSave(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	if req.Name == "" || req.Content == "" {
		h.jsonErr(w, "name 和 content 不能为空", 400)
		return
	}
	if err := h.nginx.Save(req.Name, req.Content); err != nil {
		h.jsonErr(w, err.Error(), 400)
		return
	}
	log.Printf("[Admin] Nginx 配置已保存: %s", req.Name)
	h.jsonOK(w, map[string]string{"status": "ok"})
}

func (h *AdminHandler) handleNginxDelete(w http.ResponseWriter, r *http.Request, name string) {
	if err := h.nginx.Delete(name); err != nil {
		h.jsonErr(w, err.Error(), 400)
		return
	}
	log.Printf("[Admin] Nginx 配置已删除: %s", name)
	h.jsonOK(w, map[string]string{"status": "ok"})
}

func (h *AdminHandler) handleNginxTest(w http.ResponseWriter, r *http.Request) {
	h.jsonOK(w, h.nginx.Test())
}

func (h *AdminHandler) handleNginxReload(w http.ResponseWriter, r *http.Request) {
	if err := h.nginx.Reload(); err != nil {
		h.jsonErr(w, err.Error(), 500)
		return
	}
	log.Printf("[Admin] Nginx 已重载")
	h.jsonOK(w, map[string]string{"status": "ok", "time": time.Now().Format("15:04:05")})
}

func (h *AdminHandler) handleNginxToggle(w http.ResponseWriter, r *http.Request, name string) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.jsonErr(w, "请求格式错误", 400)
		return
	}
	if err := h.nginx.SetEnabled(name, req.Enabled); err != nil {
		h.jsonErr(w, err.Error(), 400)
		return
	}
	h.jsonOK(w, map[string]string{"status": "ok"})
}
