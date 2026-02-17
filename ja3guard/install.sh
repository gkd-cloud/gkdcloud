#!/usr/bin/env bash
#
# JA3 Guard 一键部署脚本（裸机版，无需 Docker）
#
# 交互式:
#   curl -fsSL <url>/install.sh | sudo bash
#
# 非交互式 (通过环境变量):
#   curl -fsSL <url>/install.sh | JA3_DOMAIN=sub.example.com sudo -E bash
#
# 本地运行:
#   cd ja3guard && sudo bash install.sh
#
# 环境变量 (可选，跳过交互提问):
#   JA3_DOMAIN          - 订阅域名 (必填，无默认值)
#   JA3_UPSTREAM        - 上游地址 (默认 127.0.0.1:8080)
#   JA3_ADMIN_PASSWORD  - 管理面板密码 (默认随机生成)
#   JA3_ACME_EMAIL      - ACME 邮箱 (默认空)
#
# 支持: Debian 11/12, Ubuntu 20.04/22.04/24.04, CentOS 8/9 (Stream), RHEL 8/9
#
set -euo pipefail

# ============================================================
# 常量
# ============================================================
readonly APP_NAME="ja3guard"
readonly INSTALL_DIR="/opt/ja3guard"
readonly DATA_DIR="/opt/ja3guard/data"
readonly BIN_PATH="/usr/local/bin/ja3guard"
readonly SERVICE_NAME="ja3guard"
readonly GO_VERSION="1.22.5"
readonly GO_MIN_VERSION="1.22"
readonly REPO_URL="https://github.com/gkd-cloud/gkdcloud.git"
readonly REPO_SUBDIR="ja3guard"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================
# 工具函数
# ============================================================
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${CYAN}▶ $*${NC}"; }

# 从终端读取用户输入（兼容 curl | bash）
# 用法: ask "提示文字" 变量名 [默认值]
ask() {
    local prompt="$1"
    local varname="$2"
    local default="${3:-}"

    if [[ -n "$default" ]]; then
        prompt="${prompt} [${default}]"
    fi

    local answer=""
    # 尝试从 /dev/tty 读取（curl | bash 场景）
    if read -rp "  ${prompt}: " answer </dev/tty 2>/dev/null; then
        : # 读取成功
    else
        # /dev/tty 不可用（如 CI 环境），使用默认值
        answer=""
    fi

    # 如果用户没输入，使用默认值
    if [[ -z "$answer" ]]; then
        answer="$default"
    fi

    # 赋值给目标变量
    printf -v "$varname" '%s' "$answer"
}

# 确认提示，返回 0=yes 1=no
# 用法: confirm "提示" [y/n 默认]
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local hint="y/N"
    [[ "$default" == "y" ]] && hint="Y/n"

    local answer=""
    if read -rp "  ${prompt} [${hint}] " answer </dev/tty 2>/dev/null; then
        : # 读取成功
    else
        answer="$default"
    fi

    answer="${answer:-$default}"
    [[ "$answer" == "y" || "$answer" == "Y" ]]
}

# 检查是否 root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "请使用 root 用户运行此脚本"
        echo "  sudo bash install.sh"
        echo "  或: curl -fsSL <url>/install.sh | sudo bash"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        error "无法检测操作系统，仅支持 Debian/Ubuntu/CentOS"
        exit 1
    fi

    case "$OS" in
        debian|ubuntu)
            PKG_MANAGER="apt"
            ;;
        centos|rhel|rocky|almalinux)
            PKG_MANAGER="yum"
            if command -v dnf &>/dev/null; then
                PKG_MANAGER="dnf"
            fi
            ;;
        *)
            error "不支持的操作系统: $OS $OS_VERSION"
            echo "  支持: Debian 11/12, Ubuntu 20.04+, CentOS/RHEL 8+"
            exit 1
            ;;
    esac

    info "操作系统: $OS $OS_VERSION (包管理器: $PKG_MANAGER)"
}

# 检测 CPU 架构
detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            GO_ARCH="amd64"
            ;;
        aarch64|arm64)
            GO_ARCH="arm64"
            ;;
        *)
            error "不支持的 CPU 架构: $arch"
            exit 1
            ;;
    esac
    info "CPU 架构: $arch → Go GOARCH=$GO_ARCH"
}

# 安装系统依赖
install_deps() {
    step "安装系统依赖"

    local deps_needed=()

    # 检查每个依赖
    command -v curl  &>/dev/null || deps_needed+=(curl)
    command -v wget  &>/dev/null || deps_needed+=(wget)
    command -v git   &>/dev/null || deps_needed+=(git)
    command -v tar   &>/dev/null || deps_needed+=(tar)

    # ca-certificates 不好通过 command 检查，总是安装
    if [[ "$PKG_MANAGER" == "apt" ]]; then
        deps_needed+=(ca-certificates)
    fi

    if [[ ${#deps_needed[@]} -eq 0 ]]; then
        info "系统依赖已满足"
        return
    fi

    info "需要安装: ${deps_needed[*]}"

    case "$PKG_MANAGER" in
        apt)
            apt-get update -qq
            apt-get install -y -qq "${deps_needed[@]}"
            ;;
        yum|dnf)
            $PKG_MANAGER install -y -q "${deps_needed[@]}"
            ;;
    esac

    info "系统依赖安装完成"
}

# 版本比较: 返回 0 表示 $1 >= $2
version_ge() {
    printf '%s\n%s' "$2" "$1" | sort -V -C
}

# 安装或检查 Go 环境
setup_go() {
    step "检查 Go 环境"

    # 检查是否已安装
    if command -v go &>/dev/null; then
        local current_version
        current_version=$(go version | grep -oP 'go\K[0-9]+\.[0-9]+(\.[0-9]+)?' || echo "0.0")
        if version_ge "$current_version" "$GO_MIN_VERSION"; then
            info "Go 已安装: $current_version (满足 >= $GO_MIN_VERSION)"
            return
        fi
        warn "Go 版本过低: $current_version，需要 >= $GO_MIN_VERSION，将安装新版本"
    fi

    info "安装 Go $GO_VERSION ..."

    local go_tarball="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
    local go_url="https://go.dev/dl/${go_tarball}"
    local tmp_dir
    tmp_dir=$(mktemp -d)

    # 下载
    info "下载 $go_url"
    if ! curl -fsSL -o "${tmp_dir}/${go_tarball}" "$go_url"; then
        error "下载 Go 失败，请检查网络"
        echo "  如果在中国大陆，可尝试手动下载:"
        echo "  https://golang.google.cn/dl/${go_tarball}"
        rm -rf "$tmp_dir"
        exit 1
    fi

    # 安装
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "${tmp_dir}/${go_tarball}"
    rm -rf "$tmp_dir"

    # 设置 PATH
    if ! grep -q '/usr/local/go/bin' /etc/profile.d/go.sh 2>/dev/null; then
        echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
    fi
    export PATH=$PATH:/usr/local/go/bin

    # 验证
    if ! go version &>/dev/null; then
        error "Go 安装失败"
        exit 1
    fi
    info "Go 安装成功: $(go version)"
}

# 检查端口占用
check_ports() {
    step "检查端口占用"

    local ports_in_use=()

    for port in 80 443; do
        if ss -tlnp | grep -q ":${port} "; then
            local process
            process=$(ss -tlnp | grep ":${port} " | grep -oP 'users:\(\("\K[^"]+' || echo "未知进程")
            ports_in_use+=("${port} (被 ${process} 占用)")
        fi
    done

    if [[ ${#ports_in_use[@]} -gt 0 ]]; then
        warn "以下端口已被占用:"
        for p in "${ports_in_use[@]}"; do
            echo "    - 端口 $p"
        done
        echo ""
        echo "  如果是 Nginx 占用了 443 端口，你可以:"
        echo "  1. 使用 Nginx Stream SNI 分流（详见 README）"
        echo "  2. 修改 JA3 Guard 监听端口后用 Nginx 转发"
        echo ""
        if ! confirm "是否继续安装？"; then
            info "已取消安装"
            exit 0
        fi
    else
        info "端口 80, 443 可用"
    fi
}

# 构建 JA3 Guard
build_app() {
    step "构建 JA3 Guard"

    local source_dir
    # 判断源码位置: 脚本同目录有 go.mod 就用它，否则需要克隆
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [[ -f "${script_dir}/go.mod" ]] && grep -q "module ja3guard" "${script_dir}/go.mod"; then
        source_dir="$script_dir"
        info "使用本地源码: $source_dir"
    elif [[ -f "${INSTALL_DIR}/go.mod" ]] && grep -q "module ja3guard" "${INSTALL_DIR}/go.mod"; then
        source_dir="$INSTALL_DIR"
        info "使用已有源码: $source_dir"
    else
        # 本地没有源码，从 GitHub 克隆
        info "未找到本地源码，从 GitHub 克隆 ..."
        local clone_dir
        clone_dir=$(mktemp -d)
        if ! git clone --depth 1 "$REPO_URL" "$clone_dir"; then
            error "克隆仓库失败，请检查网络"
            rm -rf "$clone_dir"
            exit 1
        fi
        source_dir="${clone_dir}/${REPO_SUBDIR}"
        if [[ ! -f "${source_dir}/go.mod" ]]; then
            error "克隆的仓库中未找到 ${REPO_SUBDIR}/go.mod"
            rm -rf "$clone_dir"
            exit 1
        fi
        info "源码已克隆到临时目录"
    fi

    # 复制源码到安装目录（如果不在安装目录）
    if [[ "$source_dir" != "$INSTALL_DIR" ]]; then
        mkdir -p "$INSTALL_DIR"
        # 复制 Go 源文件和 web 目录
        cp -r "${source_dir}"/*.go "${INSTALL_DIR}/"
        cp -r "${source_dir}/go.mod" "${INSTALL_DIR}/"
        [[ -f "${source_dir}/go.sum" ]] && cp "${source_dir}/go.sum" "${INSTALL_DIR}/"
        [[ -d "${source_dir}/web" ]] && cp -r "${source_dir}/web" "${INSTALL_DIR}/"
        info "源码已复制到 $INSTALL_DIR"
    fi

    cd "$INSTALL_DIR"

    # 设置 Go 代理（中国大陆加速）
    export GOPROXY="https://goproxy.cn,https://proxy.golang.org,direct"

    info "下载依赖 ..."
    go mod tidy

    info "编译二进制 ..."
    CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o "$BIN_PATH" .

    if [[ ! -x "$BIN_PATH" ]]; then
        error "编译失败"
        exit 1
    fi

    local bin_size
    bin_size=$(du -sh "$BIN_PATH" | cut -f1)
    info "编译成功: $BIN_PATH ($bin_size)"
}

# 生成配置文件
setup_config() {
    step "配置 JA3 Guard"

    mkdir -p "$DATA_DIR"

    local config_file="${DATA_DIR}/config.json"

    if [[ -f "$config_file" ]]; then
        info "配置文件已存在: $config_file"
        if ! confirm "是否重新生成？(会备份旧配置)"; then
            info "保留现有配置"
            return
        fi
        cp "$config_file" "${config_file}.bak.$(date +%Y%m%d%H%M%S)"
        info "旧配置已备份"
    fi

    # ---- 收集配置 ----
    # 优先使用环境变量，否则交互询问

    # 域名 (必填)
    local domain="${JA3_DOMAIN:-}"
    if [[ -n "$domain" ]]; then
        info "域名 (来自环境变量): $domain"
    else
        echo ""
        echo "  请填写以下配置（回车使用默认值）:"
        echo ""
        while [[ -z "$domain" ]]; do
            ask "订阅域名 (如 sub.example.com)" domain
            if [[ -z "$domain" ]]; then
                warn "域名不能为空"
            fi
        done
    fi

    # 上游地址
    local upstream="${JA3_UPSTREAM:-}"
    if [[ -n "$upstream" ]]; then
        info "上游地址 (来自环境变量): $upstream"
    else
        ask "上游地址" upstream "127.0.0.1:8080"
    fi
    # 补全 http:// 前缀
    if [[ "$upstream" != http://* && "$upstream" != https://* ]]; then
        upstream="http://${upstream}"
    fi

    # 管理密码
    local admin_password="${JA3_ADMIN_PASSWORD:-}"
    if [[ -n "$admin_password" ]]; then
        info "管理密码 (来自环境变量): ******"
    else
        ask "管理面板密码" admin_password "随机生成"
        if [[ "$admin_password" == "随机生成" || -z "$admin_password" ]]; then
            admin_password=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
            info "已生成随机密码: $admin_password"
        fi
    fi

    # Guard Secret (总是自动生成)
    local guard_secret
    guard_secret=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
    info "已生成 guard_secret: $guard_secret"

    # ACME 邮箱
    local acme_email="${JA3_ACME_EMAIL:-}"
    if [[ -z "$acme_email" ]]; then
        ask "ACME 邮箱 (用于 Let's Encrypt，可留空)" acme_email ""
    else
        info "ACME 邮箱 (来自环境变量): $acme_email"
    fi

    # 写入配置
    cat > "$config_file" <<JSONEOF
{
  "domain": "${domain}",
  "upstream": "${upstream}",
  "listen_https": ":443",
  "listen_admin": ":8443",
  "admin_password": "${admin_password}",
  "guard_secret": "${guard_secret}",
  "acme_email": "${acme_email}",
  "data_dir": "${DATA_DIR}",
  "log_enabled": true
}
JSONEOF

    chmod 600 "$config_file"
    info "配置已写入: $config_file"
}

# 配置 systemd 服务
setup_systemd() {
    step "配置 systemd 服务"

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SERVICEEOF
[Unit]
Description=JA3 Guard - TLS Fingerprint Reverse Proxy
Documentation=https://github.com/gkd-cloud/gkdcloud
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${BIN_PATH} -config ${DATA_DIR}/config.json
WorkingDirectory=${INSTALL_DIR}
Restart=on-failure
RestartSec=5

# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}
PrivateTmp=true

# 允许绑定低端口 (80, 443)
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

# 日志
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
SERVICEEOF

    systemctl daemon-reload
    info "systemd 服务已创建: ${SERVICE_NAME}.service"
}

# 配置防火墙
setup_firewall() {
    step "配置防火墙"

    if command -v ufw &>/dev/null; then
        info "检测到 ufw"
        ufw allow 80/tcp  >/dev/null 2>&1 || true
        ufw allow 443/tcp >/dev/null 2>&1 || true
        info "已放行 80, 443 端口"
    elif command -v firewall-cmd &>/dev/null; then
        info "检测到 firewalld"
        firewall-cmd --permanent --add-port=80/tcp  >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port=443/tcp >/dev/null 2>&1 || true
        firewall-cmd --reload >/dev/null 2>&1 || true
        info "已放行 80, 443 端口"
    else
        warn "未检测到防火墙工具 (ufw/firewalld)"
        echo "  请手动确保 80 和 443 端口已放行"
    fi
}

# 启动服务
start_service() {
    step "启动服务"

    systemctl enable "$SERVICE_NAME" --now

    # 等待 2 秒检查状态
    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        info "JA3 Guard 已启动"
    else
        error "启动失败，查看日志:"
        journalctl -u "$SERVICE_NAME" -n 20 --no-pager
        exit 1
    fi
}

# 打印安装摘要
print_summary() {
    local config_file="${DATA_DIR}/config.json"
    local domain admin_password guard_secret

    domain=$(grep -oP '"domain"\s*:\s*"\K[^"]+' "$config_file")
    admin_password=$(grep -oP '"admin_password"\s*:\s*"\K[^"]+' "$config_file")
    guard_secret=$(grep -oP '"guard_secret"\s*:\s*"\K[^"]+' "$config_file")

    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  JA3 Guard 安装完成${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "  域名:          $domain"
    echo "  安装目录:      $INSTALL_DIR"
    echo "  数据目录:      $DATA_DIR"
    echo "  配置文件:      $DATA_DIR/config.json"
    echo "  二进制文件:    $BIN_PATH"
    echo ""
    echo -e "  管理面板密码:  ${YELLOW}${admin_password}${NC}"
    echo -e "  Guard Secret:  ${YELLOW}${guard_secret}${NC}"
    echo ""
    echo "  ⚠ 请将 guard_secret 填入 SSPanel 的 config/domainReplace.php"
    echo ""
    echo -e "${CYAN}  常用命令:${NC}"
    echo "    查看状态:    systemctl status ja3guard"
    echo "    查看日志:    journalctl -u ja3guard -f"
    echo "    重启服务:    systemctl restart ja3guard"
    echo "    停止服务:    systemctl stop ja3guard"
    echo ""
    echo -e "${CYAN}  访问管理面板 (通过 SSH 隧道):${NC}"
    echo "    ssh -L 8443:localhost:8443 user@your-server"
    echo "    浏览器打开: http://localhost:8443"
    echo ""
    echo -e "${CYAN}  验证:${NC}"
    echo "    curl -I https://${domain}"
    echo ""
    echo -e "${GREEN}============================================================${NC}"
}

# ============================================================
# 卸载功能
# ============================================================
uninstall() {
    step "卸载 JA3 Guard"

    echo ""
    if ! confirm "确认卸载 JA3 Guard？数据目录将保留。"; then
        info "已取消"
        exit 0
    fi

    # 停止服务
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl stop "$SERVICE_NAME"
        info "服务已停止"
    fi

    # 移除 systemd
    if [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then
        systemctl disable "$SERVICE_NAME" 2>/dev/null || true
        rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
        systemctl daemon-reload
        info "systemd 服务已移除"
    fi

    # 移除二进制
    if [[ -f "$BIN_PATH" ]]; then
        rm -f "$BIN_PATH"
        info "二进制文件已移除: $BIN_PATH"
    fi

    # 移除源码（保留数据）
    if [[ -d "$INSTALL_DIR" ]]; then
        # 只删 .go 文件和 web 目录，保留 data/
        find "$INSTALL_DIR" -maxdepth 1 -name "*.go" -delete 2>/dev/null || true
        rm -f "${INSTALL_DIR}/go.mod" "${INSTALL_DIR}/go.sum" 2>/dev/null || true
        rm -rf "${INSTALL_DIR}/web" 2>/dev/null || true
        info "源码文件已清理（数据目录 ${DATA_DIR} 已保留）"
    fi

    echo ""
    info "卸载完成"
    echo "  数据目录保留在: $DATA_DIR"
    echo "  如需彻底删除: rm -rf $INSTALL_DIR"
}

# ============================================================
# 升级功能
# ============================================================
upgrade() {
    step "升级 JA3 Guard"

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [[ ! -f "${script_dir}/go.mod" ]] || ! grep -q "module ja3guard" "${script_dir}/go.mod" 2>/dev/null; then
        info "未检测到本地源码，将从 GitHub 拉取最新版本"
    fi

    # 检查当前是否运行中
    local was_running=false
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        was_running=true
    fi

    # 构建新版本
    build_app

    # 重启服务
    if $was_running; then
        systemctl restart "$SERVICE_NAME"
        sleep 2
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            info "升级完成，服务已重启"
        else
            error "升级后服务启动失败"
            journalctl -u "$SERVICE_NAME" -n 20 --no-pager
            exit 1
        fi
    else
        info "升级完成（服务未运行，请手动启动: systemctl start $SERVICE_NAME）"
    fi
}

# ============================================================
# 主流程
# ============================================================
main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     JA3 Guard 一键部署脚本 (裸机版)     ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""

    check_root
    detect_os
    detect_arch
    install_deps
    setup_go
    check_ports
    build_app
    setup_config
    setup_systemd
    setup_firewall
    start_service
    print_summary
}

# 处理命令行参数
case "${1:-}" in
    uninstall|remove)
        check_root
        uninstall
        ;;
    upgrade|update)
        check_root
        detect_os
        detect_arch
        setup_go
        upgrade
        ;;
    *)
        main
        ;;
esac
