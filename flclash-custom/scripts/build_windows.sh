#!/bin/bash
set -e

# GKD Cloud Client - Windows 构建脚本
# 前置要求：Flutter SDK, Go, Visual Studio (MSVC)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FLCLASH_DIR="${PROJECT_ROOT}/../FlClash"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_dependencies() {
    log_info "检查构建依赖..."

    if ! command -v flutter &> /dev/null; then
        log_error "Flutter SDK 未安装"
        exit 1
    fi

    if ! command -v go &> /dev/null; then
        log_error "Go 未安装"
        exit 1
    fi

    log_info "Flutter: $(flutter --version | head -1)"
    log_info "Go: $(go version)"
}

prepare_flclash() {
    if [ ! -d "$FLCLASH_DIR" ]; then
        log_info "克隆 FlClash 源码..."
        git clone https://github.com/chen08209/FlClash.git "$FLCLASH_DIR"
    else
        log_info "使用现有 FlClash 源码..."
    fi
}

apply_customizations() {
    log_info "应用自定义修改..."
    cd "$FLCLASH_DIR"

    # 应用补丁
    if [ -d "${PROJECT_ROOT}/patches" ]; then
        for patch in "${PROJECT_ROOT}/patches"/*.patch; do
            [ -f "$patch" ] || continue
            log_info "应用补丁: $(basename "$patch")"
            git apply "$patch" 2>/dev/null || log_warn "补丁已应用或不适用: $(basename "$patch")"
        done
    fi

    # 复制自定义模块
    if [ -d "${PROJECT_ROOT}/core" ]; then
        mkdir -p core/custom
        cp -r "${PROJECT_ROOT}/core/"* core/custom/
    fi

    for subdir in models services pages widgets; do
        if [ -d "${PROJECT_ROOT}/lib/${subdir}" ]; then
            mkdir -p "lib/${subdir}"
            cp -r "${PROJECT_ROOT}/lib/${subdir}/"* "lib/${subdir}/"
        fi
    done

    if [ -d "${PROJECT_ROOT}/config" ]; then
        mkdir -p assets/config
        cp -r "${PROJECT_ROOT}/config/"* assets/config/
    fi
}

apply_branding() {
    log_info "应用品牌定制 (Windows)..."
    local APP_NAME="GKD Cloud"

    # 修改 Windows 应用名
    if [ -f "windows/runner/main.cpp" ]; then
        sed -i "s/FlClash/${APP_NAME}/g" windows/runner/main.cpp
        log_info "Windows 应用名已修改"
    fi

    # 修改窗口标题
    if [ -f "windows/runner/Runner.rc" ]; then
        sed -i "s/FlClash/${APP_NAME}/g" windows/runner/Runner.rc
        log_info "Windows 窗口标题已修改"
    fi
}

build_core_windows() {
    log_info "构建 clash-meta 核心 (Windows amd64)..."
    cd "$FLCLASH_DIR"

    export CGO_ENABLED=1
    GOOS=windows GOARCH=amd64 go build \
        -o "windows/libclash.dll" \
        -buildmode=c-shared \
        -trimpath \
        -ldflags="-s -w" \
        ./core/

    log_info "Windows 核心构建完成"
}

build_flutter_windows() {
    log_info "构建 Flutter Windows 应用..."
    cd "$FLCLASH_DIR"

    flutter pub get
    flutter build windows --release

    log_info "Windows 构建输出: build/windows/x64/runner/Release/"
}

copy_outputs() {
    local OUTPUT_DIR="${PROJECT_ROOT}/output/windows"
    mkdir -p "$OUTPUT_DIR"

    if [ -d "build/windows/x64/runner/Release" ]; then
        cp -r build/windows/x64/runner/Release/* "$OUTPUT_DIR/"
        log_info "构建产物已复制到: ${OUTPUT_DIR}"
    fi
}

main() {
    log_info "=== GKD Cloud Client Windows 构建开始 ==="

    check_dependencies
    prepare_flclash
    apply_customizations
    apply_branding
    # build_core_windows
    # build_flutter_windows
    # copy_outputs

    log_info "=== 构建流程完成 ==="
}

main "$@"
