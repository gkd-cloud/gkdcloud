#!/bin/bash
set -e

# GKD Cloud Client - macOS 构建脚本
# 前置要求：Flutter SDK, Go, Xcode

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

    if ! command -v xcodebuild &> /dev/null; then
        log_error "Xcode 未安装"
        exit 1
    fi

    log_info "Flutter: $(flutter --version | head -1)"
    log_info "Go: $(go version)"
    log_info "Xcode: $(xcodebuild -version | head -1)"
}

prepare_flclash() {
    if [ ! -d "$FLCLASH_DIR" ]; then
        log_info "克隆 FlClash 源码..."
        git clone https://github.com/chen08209/FlClash.git "$FLCLASH_DIR"
    fi
}

apply_customizations() {
    log_info "应用自定义修改..."
    cd "$FLCLASH_DIR"

    if [ -d "${PROJECT_ROOT}/patches" ]; then
        for patch in "${PROJECT_ROOT}/patches"/*.patch; do
            [ -f "$patch" ] || continue
            log_info "应用补丁: $(basename "$patch")"
            git apply "$patch" 2>/dev/null || log_warn "补丁已应用或不适用"
        done
    fi

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
    log_info "应用品牌定制 (macOS)..."
    local APP_NAME="GKD Cloud"
    local BUNDLE_ID="com.gkdcloud.client"

    # 修改 macOS bundle ID 和应用名
    local INFO_PLIST="macos/Runner/Info.plist"
    if [ -f "$INFO_PLIST" ]; then
        # 使用 PlistBuddy 修改（macOS 系统自带工具）
        /usr/libexec/PlistBuddy -c "Set :CFBundleName ${APP_NAME}" "$INFO_PLIST" 2>/dev/null || true
        /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ${BUNDLE_ID}" "$INFO_PLIST" 2>/dev/null || true
        log_info "macOS bundle 信息已修改"
    fi
}

build_core_macos() {
    log_info "构建 clash-meta 核心 (macOS)..."
    cd "$FLCLASH_DIR"

    export CGO_ENABLED=1

    # 构建 arm64 (Apple Silicon)
    log_info "构建 arm64..."
    GOOS=darwin GOARCH=arm64 go build \
        -o "macos/libclash_arm64.dylib" \
        -buildmode=c-shared \
        -trimpath \
        -ldflags="-s -w" \
        ./core/

    # 构建 amd64 (Intel)
    log_info "构建 amd64..."
    GOOS=darwin GOARCH=amd64 go build \
        -o "macos/libclash_amd64.dylib" \
        -buildmode=c-shared \
        -trimpath \
        -ldflags="-s -w" \
        ./core/

    # 合并为 Universal Binary
    log_info "合并为 Universal Binary..."
    lipo -create \
        "macos/libclash_arm64.dylib" \
        "macos/libclash_amd64.dylib" \
        -output "macos/libclash.dylib"

    rm -f macos/libclash_arm64.dylib macos/libclash_amd64.dylib

    log_info "macOS 核心构建完成"
}

build_flutter_macos() {
    log_info "构建 Flutter macOS 应用..."
    cd "$FLCLASH_DIR"

    flutter pub get
    flutter build macos --release

    log_info "macOS 构建输出: build/macos/Build/Products/Release/"
}

copy_outputs() {
    local OUTPUT_DIR="${PROJECT_ROOT}/output/macos"
    mkdir -p "$OUTPUT_DIR"

    if [ -d "build/macos/Build/Products/Release" ]; then
        cp -r "build/macos/Build/Products/Release/"*.app "$OUTPUT_DIR/" 2>/dev/null || true
        log_info "构建产物已复制到: ${OUTPUT_DIR}"
    fi
}

main() {
    log_info "=== GKD Cloud Client macOS 构建开始 ==="

    check_dependencies
    prepare_flclash
    apply_customizations
    apply_branding
    # build_core_macos
    # build_flutter_macos
    # copy_outputs

    log_info "=== 构建流程完成 ==="
}

main "$@"
