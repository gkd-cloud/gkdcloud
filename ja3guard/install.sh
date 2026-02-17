#!/usr/bin/env bash
#
# JA3 Guard 一键部署脚本（裸机版，无需 Docker）
#
# 用法:
#   install.sh master    - 安装管理面板 (Master 模式)
#   install.sh node      - 安装 JA3 反代节点 (Node 模式，默认)
#   install.sh upgrade   - 升级现有安装
#   install.sh uninstall - 卸载（保留数据）
#   install.sh purge     - 彻底卸载（删除所有数据、配置、证书）
#
# 交互式:
#   curl -fsSL <url>/install.sh | sudo bash -s -- master
#   curl -fsSL <url>/install.sh | sudo bash -s -- node
#   curl -fsSL <url>/install.sh | sudo bash       # 默认 node
#
# 非交互式 (通过环境变量):
#   curl -fsSL <url>/install.sh | JA3_DOMAIN=sub.example.com sudo -E bash -s -- node
#
# 环境变量 (可选，跳过交互提问):
#   JA3_MODE            - 安装模式: master 或 node
#   JA3_DOMAIN          - 订阅域名 (node 模式必填)
#   JA3_UPSTREAM        - 上游地址 (node 默认 127.0.0.1:8080)
#   JA3_ADMIN_PASSWORD  - 管理面板密码 (默认随机生成)
#   JA3_ACME_EMAIL      - ACME 邮箱 (默认空)
#   JA3_WEBROOT         - SSPanel 网站根目录 (node 默认 /www/sspanel/public)
#   JA3_MASTER_URL      - Master 地址 (node 模式可选，用于上报)
#   JA3_NODE_TOKEN      - 节点令牌 (node 模式可选，用于上报)
#   JA3_NODE_NAME       - 节点名称 (node 模式可选)
#   JA3_SKIP_NGINX      - 设为 1 跳过 Nginx/PHP 安装 (纯反代模式，上游在远程服务器)
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

# Nginx 安装控制（默认安装，设为 1 跳过）
SKIP_NGINX="${JA3_SKIP_NGINX:-0}"

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

# 读取用户输入的统一入口
# stdin 是终端时直接读，否则从 /dev/tty 读（curl | bash 场景）
_read_input() {
    if [[ -t 0 ]]; then
        read "$@"
    else
        read "$@" </dev/tty
    fi
}

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
    if _read_input -rp "  ${prompt}: " answer 2>/dev/null; then
        : # 读取成功
    else
        # 读取失败（如 CI 环境），使用默认值
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
    if _read_input -rp "  ${prompt} [${hint}] " answer 2>/dev/null; then
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

# 询问上游位置（决定是否安装 Nginx/PHP）
ask_upstream_location() {
    # 如果通过环境变量已设定，跳过询问
    if [[ "$SKIP_NGINX" == "1" ]]; then
        info "跳过 Nginx/PHP 安装 (JA3_SKIP_NGINX=1)"
        return
    fi

    echo ""
    echo -e "  ${CYAN}SSPanel / 业务后端在哪里？${NC}"
    echo ""
    echo "    1) 本机 — 将安装 Nginx + PHP-FPM（SSPanel 部署在此服务器）"
    echo "    2) 远程 — 跳过 Nginx/PHP，仅安装 JA3 Guard（纯反代模式）"
    echo ""

    local choice=""
    ask "请选择" choice "2"

    case "$choice" in
        1)
            SKIP_NGINX=0
            info "将安装 Nginx + PHP-FPM"
            ;;
        *)
            SKIP_NGINX=1
            info "跳过 Nginx/PHP，仅安装 JA3 Guard 反代"
            ;;
    esac
}

# 检查端口占用
check_ports() {
    step "检查端口占用"

    local ports_in_use=()
    local all_ja3guard=true

    for port in 80 443; do
        if ss -tlnp | grep -q ":${port} "; then
            local process
            process=$(ss -tlnp | grep ":${port} " | grep -oP 'users:\(\("\K[^"]+' || echo "未知进程")
            ports_in_use+=("${port} (被 ${process} 占用)")
            # 如果占用者不是 ja3guard，标记
            if [[ "$process" != "ja3guard" ]]; then
                all_ja3guard=false
            fi
        fi
    done

    if [[ ${#ports_in_use[@]} -gt 0 ]]; then
        if $all_ja3guard; then
            # 端口被 ja3guard 自身占用（升级/重装场景），自动跳过
            info "端口被 ja3guard 占用（将在安装后重启服务）"
            return
        fi

        warn "以下端口已被占用:"
        for p in "${ports_in_use[@]}"; do
            echo "    - 端口 $p"
        done
        echo ""
        echo "  如果是 Nginx 占用了 443 端口，你可以:"
        echo "  1. 使用 Nginx Stream SNI 分流（详见 README）"
        echo "  2. 修改 JA3 Guard 监听端口后用 Nginx 转发"
        echo ""
        if ! confirm "是否继续安装？" "y"; then
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

# ============================================================
# 安装 Nginx + PHP-FPM 并配置上游站点
# ============================================================
setup_nginx() {
    step "安装 Nginx + PHP"

    # 检测是否已安装
    if command -v nginx &>/dev/null; then
        info "Nginx 已安装: $(nginx -v 2>&1 | grep -oP 'nginx/\K.*')"
    else
        info "安装 Nginx ..."
        case "$PKG_MANAGER" in
            apt)
                apt-get update -qq
                apt-get install -y -qq nginx
                ;;
            yum|dnf)
                $PKG_MANAGER install -y -q nginx
                ;;
        esac
        info "Nginx 安装完成"
    fi

    # 安装 PHP-FPM
    local php_fpm_installed=false
    if command -v php &>/dev/null; then
        info "PHP 已安装: $(php -v | head -1 | grep -oP 'PHP \K[0-9]+\.[0-9]+')"
        php_fpm_installed=true
    fi

    if ! $php_fpm_installed; then
        info "安装 PHP-FPM ..."
        case "$PKG_MANAGER" in
            apt)
                # 检测可用的 PHP 版本
                local php_ver=""
                for v in 8.3 8.2 8.1 8.0; do
                    if apt-cache show "php${v}-fpm" &>/dev/null 2>&1; then
                        php_ver="$v"
                        break
                    fi
                done

                if [[ -z "$php_ver" ]]; then
                    # 如果没找到带版本号的包，试试通用包名
                    if apt-cache show php-fpm &>/dev/null 2>&1; then
                        apt-get install -y -qq php-fpm php-cli php-curl php-mbstring php-xml php-zip php-mysql php-sqlite3
                    else
                        warn "未找到可用的 PHP-FPM 包，请手动安装"
                        warn "  apt install php-fpm php-cli php-curl php-mbstring php-xml php-zip php-mysql"
                    fi
                else
                    info "安装 PHP ${php_ver} ..."
                    apt-get install -y -qq \
                        "php${php_ver}-fpm" "php${php_ver}-cli" "php${php_ver}-curl" \
                        "php${php_ver}-mbstring" "php${php_ver}-xml" "php${php_ver}-zip" \
                        "php${php_ver}-mysql" "php${php_ver}-sqlite3"
                fi
                ;;
            yum|dnf)
                # RHEL 系用 remi 或系统自带
                if $PKG_MANAGER list php-fpm &>/dev/null 2>&1; then
                    $PKG_MANAGER install -y -q php-fpm php-cli php-curl php-mbstring php-xml php-zip php-mysqlnd
                else
                    warn "未找到 PHP-FPM 包，请手动安装或启用 Remi 仓库"
                fi
                ;;
        esac
        info "PHP-FPM 安装完成"
    fi

    # 检测 PHP-FPM socket 路径
    PHP_FPM_SOCK=""
    for sock in \
        /run/php/php*-fpm.sock \
        /var/run/php/php*-fpm.sock \
        /run/php-fpm/www.sock \
        /var/run/php-fpm/www.sock; do
        # glob 展开
        for f in $sock; do
            if [[ -S "$f" ]] || [[ -e "$f" ]]; then
                PHP_FPM_SOCK="$f"
                break 2
            fi
        done
    done

    # 如果 socket 不存在，启动 PHP-FPM 再找
    if [[ -z "$PHP_FPM_SOCK" ]]; then
        # 找到 PHP-FPM 服务名并启动
        local fpm_service
        fpm_service=$(systemctl list-unit-files | grep -oP 'php[0-9.]*-fpm\.service' | head -1 || true)
        if [[ -z "$fpm_service" ]]; then
            fpm_service="php-fpm.service"
        fi
        systemctl enable "$fpm_service" --now 2>/dev/null || true
        sleep 1
        # 再次查找
        for sock in /run/php/php*-fpm.sock /var/run/php-fpm/www.sock; do
            for f in $sock; do
                if [[ -S "$f" ]]; then
                    PHP_FPM_SOCK="$f"
                    break 2
                fi
            done
        done
    fi

    if [[ -z "$PHP_FPM_SOCK" ]]; then
        # 回退到 TCP
        PHP_FPM_SOCK="127.0.0.1:9000"
        warn "未找到 PHP-FPM socket，使用默认 TCP: $PHP_FPM_SOCK"
    else
        info "PHP-FPM socket: $PHP_FPM_SOCK"
    fi

    # 启动 Nginx 和 PHP-FPM
    systemctl enable nginx --now 2>/dev/null || true
}

# 配置 Nginx 上游站点
setup_nginx_vhost() {
    step "配置 Nginx 上游站点"

    local config_file="${DATA_DIR}/config.json"
    local domain upstream_port

    domain=$(grep -oP '"domain"\s*:\s*"\K[^"]+' "$config_file")
    upstream_port=$(grep -oP '"upstream"\s*:\s*"http://[^:]+:\K[0-9]+' "$config_file" || echo "8080")

    # SSPanel 网站根目录
    local webroot="${JA3_WEBROOT:-/www/sspanel/public}"
    if [[ ! -d "$webroot" ]]; then
        # 创建占位目录，用户后续部署 SSPanel 代码
        mkdir -p "$webroot"
        # 写一个测试页面
        cat > "${webroot}/index.php" <<'PHPEOF'
<?php
// JA3 Guard 上游测试页面
// 部署 SSPanel 后请删除此文件

$trusted = $_SERVER['HTTP_X_JA3_TRUSTED'] ?? '0';
$ja3hash = $_SERVER['HTTP_X_JA3_HASH'] ?? 'unknown';

header('Content-Type: application/json');
echo json_encode([
    'status'  => 'ok',
    'trusted' => $trusted === '1',
    'ja3'     => $ja3hash,
    'time'    => date('Y-m-d H:i:s'),
], JSON_PRETTY_PRINT) . "\n";
PHPEOF
        info "已创建测试页面: ${webroot}/index.php"
        warn "网站目录 ${webroot} 是新建的，请后续部署 SSPanel 代码"
    fi

    # 确定 Nginx 配置目录
    local nginx_conf_dir=""
    if [[ -d /etc/nginx/sites-available ]]; then
        nginx_conf_dir="sites"  # Debian/Ubuntu 风格
    elif [[ -d /etc/nginx/conf.d ]]; then
        nginx_conf_dir="conf.d"  # CentOS/RHEL 风格
    else
        mkdir -p /etc/nginx/conf.d
        nginx_conf_dir="conf.d"
    fi

    # 判断 fastcgi_pass 格式
    local fastcgi_pass
    if [[ "$PHP_FPM_SOCK" == /* ]]; then
        fastcgi_pass="unix:${PHP_FPM_SOCK}"
    else
        fastcgi_pass="$PHP_FPM_SOCK"
    fi

    # 生成 Nginx vhost 配置
    local vhost_conf
    cat > /tmp/ja3guard-upstream.conf <<NGINXEOF
# JA3 Guard 上游站点 - 由 install.sh 自动生成
# 仅监听本地 ${upstream_port} 端口，接收来自 JA3 Guard 的反代请求
server {
    listen 127.0.0.1:${upstream_port};
    server_name ${domain};

    root ${webroot};
    index index.php index.html;

    # 安全: 仅允许来自 JA3 Guard 的本地连接
    allow 127.0.0.1;
    deny all;

    # 日志
    access_log /var/log/nginx/ja3guard-upstream-access.log;
    error_log  /var/log/nginx/ja3guard-upstream-error.log;

    location / {
        try_files \$uri /index.php\$is_args\$args;
    }

    location ~ \.php\$ {
        try_files \$uri =404;
        fastcgi_pass ${fastcgi_pass};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;

        # 传递 JA3 Guard 注入的 header 给 PHP
        fastcgi_param HTTP_X_JA3_TRUSTED \$http_x_ja3_trusted;
        fastcgi_param HTTP_X_JA3_HASH    \$http_x_ja3_hash;
        fastcgi_param HTTP_X_GUARD_SECRET \$http_x_guard_secret;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
NGINXEOF

    if [[ "$nginx_conf_dir" == "sites" ]]; then
        vhost_conf="/etc/nginx/sites-available/ja3guard-upstream"
        cp /tmp/ja3guard-upstream.conf "$vhost_conf"
        ln -sf "$vhost_conf" /etc/nginx/sites-enabled/ja3guard-upstream
        # 移除默认站点避免冲突
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    else
        vhost_conf="/etc/nginx/conf.d/ja3guard-upstream.conf"
        cp /tmp/ja3guard-upstream.conf "$vhost_conf"
    fi
    rm -f /tmp/ja3guard-upstream.conf

    info "Nginx 配置已写入: $vhost_conf"

    # 测试 Nginx 配置
    if nginx -t 2>/dev/null; then
        info "Nginx 配置测试通过"
        systemctl reload nginx
        info "Nginx 已重载"
    else
        error "Nginx 配置测试失败:"
        nginx -t
        exit 1
    fi

    # 验证上游端口是否监听
    sleep 1
    if ss -tlnp | grep -q ":${upstream_port}.*nginx"; then
        info "Nginx 上游已监听 127.0.0.1:${upstream_port}"
    else
        warn "Nginx 可能未监听 ${upstream_port} 端口，请检查配置"
    fi
}

# 生成配置文件
setup_config() {
    step "配置 JA3 Guard (${INSTALL_MODE} 模式)"

    mkdir -p "$DATA_DIR"

    local config_file="${DATA_DIR}/config.json"

    if [[ -f "$config_file" ]]; then
        # 如果配置已存在且没有提供任何 JA3_* 环境变量 → 直接使用（Master 预推送场景）
        local has_env_vars=false
        for v in JA3_DOMAIN JA3_UPSTREAM JA3_ADMIN_PASSWORD JA3_MASTER_URL JA3_NODE_TOKEN JA3_NODE_NAME; do
            if [[ -n "${!v:-}" ]]; then
                has_env_vars=true
                break
            fi
        done
        if ! $has_env_vars; then
            info "配置文件已存在: $config_file"
            if ! confirm "是否重新生成？(会备份旧配置)"; then
                info "保留现有配置"
                return
            fi
        fi
        cp "$config_file" "${config_file}.bak.$(date +%Y%m%d%H%M%S)"
        info "旧配置已备份"
    fi

    echo ""
    echo "  请填写以下配置（回车使用默认值）:"
    echo ""

    # 管理密码（两种模式都需要）
    local admin_password="${JA3_ADMIN_PASSWORD:-}"
    if [[ -n "$admin_password" ]]; then
        info "管理密码 (来自环境变量): ******"
    else
        echo "  管理面板密码用于登录 Web 管理界面 (http://IP:8443)"
        echo "  直接回车将自动生成随机密码"
        echo ""
        ask "设置管理面板密码" admin_password "随机生成"
        if [[ "$admin_password" == "随机生成" || -z "$admin_password" ]]; then
            admin_password=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
            info "已生成随机密码: $admin_password"
        fi
    fi

    if [[ "$INSTALL_MODE" == "master" ]]; then
        setup_config_master "$config_file" "$admin_password"
    else
        setup_config_node "$config_file" "$admin_password"
    fi

    chmod 600 "$config_file"
    info "配置已写入: $config_file"
}

# Master 模式配置
setup_config_master() {
    local config_file="$1"
    local admin_password="$2"

    # ACME 邮箱（可选，Master 也可能需要 HTTPS）
    local acme_email="${JA3_ACME_EMAIL:-}"
    if [[ -z "$acme_email" ]]; then
        ask "ACME 邮箱 (可留空)" acme_email ""
    else
        info "ACME 邮箱 (来自环境变量): $acme_email"
    fi

    cat > "$config_file" <<JSONEOF
{
  "mode": "master",
  "listen_admin": ":8443",
  "admin_password": "${admin_password}",
  "guard_secret": "master-default",
  "acme_email": "${acme_email}",
  "data_dir": "${DATA_DIR}",
  "log_enabled": true
}
JSONEOF
}

# Node 模式配置
setup_config_node() {
    local config_file="$1"
    local admin_password="$2"

    # 域名 (必填)
    local domain="${JA3_DOMAIN:-}"
    if [[ -n "$domain" ]]; then
        info "域名 (来自环境变量): $domain"
    else
        echo ""
        echo "  订阅域名: 用于申请 Let's Encrypt 证书，DNS 需直连服务器（不走 CDN）"
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
    elif [[ "$SKIP_NGINX" == "1" ]]; then
        echo ""
        echo "  上游地址: 远程业务服务器的 IP:端口（JA3 Guard 将反代到此地址）"
        echo "  示例: 10.0.0.5:80 (内网) 或 203.0.113.1:80 (公网)"
        while [[ -z "$upstream" ]]; do
            ask "上游地址 (远程 IP:端口)" upstream
            if [[ -z "$upstream" ]]; then
                warn "纯反代模式下上游地址不能为空"
            fi
        done
    else
        echo ""
        echo "  上游地址: JA3 Guard 反代到的 Nginx 端口，通常保持默认即可"
        ask "上游地址" upstream "127.0.0.1:8080"
    fi
    if [[ "$upstream" != http://* && "$upstream" != https://* ]]; then
        upstream="http://${upstream}"
    fi

    # Guard Secret
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

    # Master 上报配置（可选）
    local master_url="${JA3_MASTER_URL:-}"
    local node_token="${JA3_NODE_TOKEN:-}"
    local node_name="${JA3_NODE_NAME:-}"

    if [[ -z "$master_url" ]]; then
        echo ""
        echo "  Master 上报: 填写后节点会定期向 Master 上报状态和日志"
        echo "  如果没有 Master 或仅单机使用，直接回车跳过"
        ask "Master 地址 (如 http://master-ip:8443)" master_url ""
    fi

    if [[ -n "$master_url" ]]; then
        if [[ -z "$node_token" ]]; then
            echo ""
            echo "  节点令牌: 在 Master 管理面板 → Nodes → 添加节点后生成"
            ask "节点令牌" node_token ""
        fi
        if [[ -z "$node_name" ]]; then
            local hostname_default
            hostname_default=$(hostname -s 2>/dev/null || echo "node-1")
            ask "节点名称" node_name "$hostname_default"
        fi
    fi

    cat > "$config_file" <<JSONEOF
{
  "mode": "node",
  "domain": "${domain}",
  "upstream": "${upstream}",
  "listen_https": ":443",
  "listen_admin": ":8443",
  "admin_password": "${admin_password}",
  "guard_secret": "${guard_secret}",
  "acme_email": "${acme_email}",
  "data_dir": "${DATA_DIR}",
  "log_enabled": true,
  "master_url": "${master_url}",
  "node_token": "${node_token}",
  "node_name": "${node_name}",
  "report_interval": 60
}
JSONEOF
}

# 配置 systemd 服务
setup_systemd() {
    step "配置 systemd 服务"

    local svc_desc="JA3 Guard"
    if [[ "$INSTALL_MODE" == "master" ]]; then
        svc_desc="JA3 Guard Master - Node Management Panel"
    else
        svc_desc="JA3 Guard Node - TLS Fingerprint Reverse Proxy"
    fi

    local capabilities=""
    if [[ "$INSTALL_MODE" == "node" ]]; then
        capabilities="
# 允许绑定低端口 (80, 443)
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE"
    fi

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SERVICEEOF
[Unit]
Description=${svc_desc}
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
${capabilities}
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

    local ports=()
    if [[ "$INSTALL_MODE" == "master" ]]; then
        ports=(8443)
    else
        ports=(80 443 8443)
    fi

    if command -v ufw &>/dev/null; then
        info "检测到 ufw"
        for port in "${ports[@]}"; do
            ufw allow "${port}/tcp" >/dev/null 2>&1 || true
        done
        info "已放行端口: ${ports[*]}"
    elif command -v firewall-cmd &>/dev/null; then
        info "检测到 firewalld"
        for port in "${ports[@]}"; do
            firewall-cmd --permanent --add-port="${port}/tcp" >/dev/null 2>&1 || true
        done
        firewall-cmd --reload >/dev/null 2>&1 || true
        info "已放行端口: ${ports[*]}"
    else
        warn "未检测到防火墙工具 (ufw/firewalld)"
        echo "  请手动确保端口已放行: ${ports[*]}"
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
    local admin_password
    admin_password=$(grep -oP '"admin_password"\s*:\s*"\K[^"]+' "$config_file")

    echo ""
    echo -e "${GREEN}============================================================${NC}"
    if [[ "$INSTALL_MODE" == "master" ]]; then
        echo -e "${GREEN}  JA3 Guard Master 安装完成${NC}"
    else
        echo -e "${GREEN}  JA3 Guard Node 安装完成${NC}"
    fi
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${CYAN}  [基本信息]${NC}"
    echo "  安装模式:      $INSTALL_MODE"
    echo "  安装目录:      $INSTALL_DIR"
    echo "  数据目录:      $DATA_DIR"
    echo "  配置文件:      $DATA_DIR/config.json"
    echo "  二进制文件:    $BIN_PATH"
    echo ""
    echo -e "  管理面板密码:  ${YELLOW}${admin_password}${NC}"

    if [[ "$INSTALL_MODE" == "master" ]]; then
        echo ""
        echo -e "${CYAN}  [Master 模式]${NC}"
        echo "  管理面板:      http://服务器IP:8443"
        echo "  功能:"
        echo "    - 管理子节点 (添加/删除/SSH)"
        echo "    - 查看所有节点状态和日志"
        echo "    - 管理白名单并同步到节点"
        echo ""
        echo -e "${CYAN}  下一步:${NC}"
        echo "    1. 访问管理面板，进入 Nodes 标签页"
        echo "    2. 添加子节点 (填写 IP、SSH 信息)"
        echo "    3. 获取节点 Token"
        echo "    4. 在子节点服务器运行:"
        echo -e "       ${YELLOW}curl -fsSL <url>/install.sh | sudo bash -s -- node${NC}"
    else
        local domain guard_secret upstream_port webroot
        domain=$(grep -oP '"domain"\s*:\s*"\K[^"]+' "$config_file")
        guard_secret=$(grep -oP '"guard_secret"\s*:\s*"\K[^"]+' "$config_file")
        upstream_port=$(grep -oP '"upstream"\s*:\s*"http://[^:]+:\K[0-9]+' "$config_file" || echo "8080")
        webroot="${JA3_WEBROOT:-/www/sspanel/public}"

        echo -e "  Guard Secret:  ${YELLOW}${guard_secret}${NC}"
        echo ""
        echo -e "${CYAN}  [Node 模式]${NC}"
        echo "  域名:          $domain"
        echo ""

        local upstream_full
        upstream_full=$(grep -oP '"upstream"\s*:\s*"\K[^"]+' "$config_file")

        if [[ "$SKIP_NGINX" == "1" ]]; then
            echo -e "${CYAN}  [纯反代模式 — 无 Nginx]${NC}"
            echo "  上游地址:      ${upstream_full}"
            echo ""
            echo -e "${CYAN}  [请求链路]${NC}"
            echo "  用户 → :443 (JA3 Guard) → ${upstream_full} (远程业务服务器)"
        else
            echo -e "${CYAN}  [Nginx 上游]${NC}"
            echo "  监听地址:      127.0.0.1:${upstream_port}"
            echo "  网站根目录:    ${webroot}"
            echo ""
            echo -e "${CYAN}  [请求链路]${NC}"
            echo "  用户 → :443 (JA3 Guard) → 127.0.0.1:${upstream_port} (Nginx) → PHP-FPM"
            echo ""
            echo "  ⚠ 请将 guard_secret 填入 SSPanel 的 config/domainReplace.php"
            echo "  ⚠ 请将 SSPanel 代码部署到 ${webroot}"
        fi
    fi

    echo ""
    echo -e "${CYAN}  常用命令:${NC}"
    echo "    查看状态:    systemctl status ja3guard"
    echo "    查看日志:    journalctl -u ja3guard -f"
    echo "    重启服务:    systemctl restart ja3guard"
    echo "    停止服务:    systemctl stop ja3guard"
    echo ""
    echo -e "${CYAN}  访问管理面板:${NC}"
    echo "    ssh -L 8443:localhost:8443 user@your-server"
    echo "    浏览器打开: http://localhost:8443"
    echo ""
    echo -e "${GREEN}============================================================${NC}"
}

# ============================================================
# 卸载功能
# ============================================================
uninstall() {
    local purge="${1:-}"

    step "卸载 JA3 Guard"

    if [[ "$purge" == "purge" ]]; then
        echo ""
        warn "彻底卸载将删除所有数据（配置、证书、白名单、日志）"
        if ! confirm "确认彻底卸载？此操作不可恢复！"; then
            info "已取消"
            exit 0
        fi
    else
        echo ""
        if ! confirm "确认卸载 JA3 Guard？数据目录将保留。"; then
            info "已取消"
            exit 0
        fi
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

    # 移除 Nginx 配置
    local nginx_changed=false
    if [[ -f /etc/nginx/sites-available/ja3guard-upstream ]]; then
        rm -f /etc/nginx/sites-enabled/ja3guard-upstream
        rm -f /etc/nginx/sites-available/ja3guard-upstream
        nginx_changed=true
        info "Nginx 站点配置已移除 (sites-available)"
    fi
    if [[ -f /etc/nginx/conf.d/ja3guard-upstream.conf ]]; then
        rm -f /etc/nginx/conf.d/ja3guard-upstream.conf
        nginx_changed=true
        info "Nginx 站点配置已移除 (conf.d)"
    fi
    if $nginx_changed && command -v nginx &>/dev/null; then
        nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
        info "Nginx 已重载"
    fi

    if [[ "$purge" == "purge" ]]; then
        # 彻底卸载: 删除整个安装目录（含数据）
        if [[ -d "$INSTALL_DIR" ]]; then
            rm -rf "$INSTALL_DIR"
            info "安装目录已删除: $INSTALL_DIR"
        fi
    else
        # 普通卸载: 只删源码，保留数据
        if [[ -d "$INSTALL_DIR" ]]; then
            find "$INSTALL_DIR" -maxdepth 1 -name "*.go" -delete 2>/dev/null || true
            rm -f "${INSTALL_DIR}/go.mod" "${INSTALL_DIR}/go.sum" 2>/dev/null || true
            rm -rf "${INSTALL_DIR}/web" 2>/dev/null || true
            info "源码文件已清理（数据目录 ${DATA_DIR} 已保留）"
        fi
    fi

    echo ""
    info "卸载完成"
    if [[ "$purge" != "purge" ]]; then
        echo "  数据目录保留在: $DATA_DIR"
        echo "  如需彻底删除: sudo bash install.sh purge"
    else
        echo "  所有文件已清除，可重新安装:"
        echo "    sudo bash install.sh master  # 安装管理面板"
        echo "    sudo bash install.sh node    # 安装反代节点"
    fi
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

# 安装模式: 通过参数或环境变量传入
INSTALL_MODE="${JA3_MODE:-node}"

main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     JA3 Guard 一键部署脚本 (裸机版)     ║${NC}"
    echo -e "${CYAN}║                                          ║${NC}"
    if [[ "$INSTALL_MODE" == "master" ]]; then
    echo -e "${CYAN}║         模式: ${YELLOW}MASTER (管理面板)${CYAN}          ║${NC}"
    else
    echo -e "${CYAN}║         模式: ${GREEN}NODE (JA3 反代节点)${CYAN}       ║${NC}"
    fi
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""

    check_root
    detect_os
    detect_arch
    install_deps
    setup_go

    if [[ "$INSTALL_MODE" == "node" ]]; then
        ask_upstream_location
        if [[ "$SKIP_NGINX" != "1" ]]; then
            setup_nginx
        fi
        check_ports
    fi

    build_app
    setup_config

    if [[ "$INSTALL_MODE" == "node" && "$SKIP_NGINX" != "1" ]]; then
        setup_nginx_vhost
    fi

    setup_systemd
    setup_firewall
    start_service
    print_summary
}

# 处理命令行参数
case "${1:-}" in
    master)
        INSTALL_MODE="master"
        main
        ;;
    node)
        INSTALL_MODE="node"
        main
        ;;
    uninstall|remove)
        check_root
        uninstall
        ;;
    purge)
        check_root
        uninstall purge
        ;;
    upgrade|update)
        check_root
        detect_os
        detect_arch
        setup_go
        upgrade
        ;;
    help|-h|--help)
        echo "用法: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  master     安装 Master 管理面板（不含 Nginx/PHP）"
        echo "  node       安装 Node 反代节点（Nginx/PHP 可选，默认）"
        echo "  upgrade    升级现有安装"
        echo "  uninstall  卸载（保留数据目录）"
        echo "  purge      彻底卸载（删除所有数据）"
        echo "  help       显示帮助"
        echo ""
        echo "远程安装:"
        echo "  curl -fsSL <url>/install.sh | sudo bash -s -- master"
        echo "  curl -fsSL <url>/install.sh | sudo bash -s -- node"
        echo ""
        echo "彻底卸载后重装:"
        echo "  sudo bash install.sh purge && sudo bash install.sh master"
        ;;
    *)
        # 默认: 询问模式或使用环境变量
        if [[ -n "${JA3_MODE:-}" ]]; then
            INSTALL_MODE="$JA3_MODE"
        fi
        main
        ;;
esac
