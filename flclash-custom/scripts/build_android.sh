#!/bin/bash
set -e

# GKD Cloud Client - Android 构建脚本
# 前置要求：Flutter SDK, Android SDK, Go

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FLCLASH_DIR="${PROJECT_ROOT}/../FlClash"  # FlClash 源码目录

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查依赖
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

    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        log_error "ANDROID_HOME 或 ANDROID_SDK_ROOT 未设置"
        exit 1
    fi

    log_info "Flutter: $(flutter --version | head -1)"
    log_info "Go: $(go version)"
}

# 克隆或更新 FlClash 源码
prepare_flclash() {
    if [ ! -d "$FLCLASH_DIR" ]; then
        log_info "克隆 FlClash 源码..."
        git clone https://github.com/chen08209/FlClash.git "$FLCLASH_DIR"
    else
        log_info "更新 FlClash 源码..."
        cd "$FLCLASH_DIR"
        git pull origin main || log_warn "更新失败，使用现有代码"
    fi
}

# 应用自定义修改
apply_customizations() {
    log_info "应用自定义修改..."
    cd "$FLCLASH_DIR"

    # 应用补丁文件（如果存在）
    if [ -d "${PROJECT_ROOT}/patches" ]; then
        for patch in "${PROJECT_ROOT}/patches"/*.patch; do
            [ -f "$patch" ] || continue
            log_info "应用补丁: $(basename "$patch")"
            git apply "$patch" || log_warn "补丁应用失败: $(basename "$patch")"
        done
    fi

    # 复制自定义 Go 核心模块
    log_info "复制自定义核心模块..."
    if [ -d "${PROJECT_ROOT}/core" ]; then
        # 创建自定义模块目录
        mkdir -p core/custom
        cp -r "${PROJECT_ROOT}/core/"* core/custom/
    fi

    # 复制自定义 Dart 文件
    log_info "复制自定义 Dart 模块..."
    for subdir in models services pages widgets; do
        if [ -d "${PROJECT_ROOT}/lib/${subdir}" ]; then
            mkdir -p "lib/${subdir}"
            cp -r "${PROJECT_ROOT}/lib/${subdir}/"* "lib/${subdir}/"
        fi
    done

    # 复制配置文件
    if [ -d "${PROJECT_ROOT}/config" ]; then
        mkdir -p assets/config
        cp -r "${PROJECT_ROOT}/config/"* assets/config/
    fi
}

# 修改应用信息（品牌定制）
apply_branding() {
    log_info "应用品牌定制..."

    # 读取 branding 配置（简化处理，实际应使用 yq 等工具）
    local APP_NAME="GKD Cloud"
    local PACKAGE_NAME="com.gkdcloud.client"

    # 修改 Android 包名
    if [ -f "android/app/build.gradle" ]; then
        sed -i "s/applicationId .*/applicationId \"${PACKAGE_NAME}\"/" android/app/build.gradle
        log_info "Android 包名已修改: ${PACKAGE_NAME}"
    fi

    # 修改应用名称
    if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
        sed -i "s/android:label=\"[^\"]*\"/android:label=\"${APP_NAME}\"/" \
            android/app/src/main/AndroidManifest.xml
        log_info "Android 应用名已修改: ${APP_NAME}"
    fi
}

# 构建 Go 核心库
build_core() {
    log_info "构建 clash-meta 核心 (Android)..."
    cd "$FLCLASH_DIR"

    # 设置 Go 交叉编译环境
    export CGO_ENABLED=1

    # 构建 arm64
    log_info "构建 arm64..."
    GOOS=android GOARCH=arm64 go build -o "android/app/src/main/jniLibs/arm64-v8a/libclash.so" \
        -buildmode=c-shared -trimpath -ldflags="-s -w" ./core/

    # 构建 armeabi-v7a
    log_info "构建 armeabi-v7a..."
    GOOS=android GOARCH=arm GOARM=7 go build -o "android/app/src/main/jniLibs/armeabi-v7a/libclash.so" \
        -buildmode=c-shared -trimpath -ldflags="-s -w" ./core/

    # 构建 x86_64 (模拟器)
    log_info "构建 x86_64..."
    GOOS=android GOARCH=amd64 go build -o "android/app/src/main/jniLibs/x86_64/libclash.so" \
        -buildmode=c-shared -trimpath -ldflags="-s -w" ./core/

    log_info "Go 核心构建完成"
}

# 构建 Flutter APK
build_flutter() {
    log_info "构建 Flutter APK..."
    cd "$FLCLASH_DIR"

    flutter pub get
    flutter build apk --release --split-per-abi

    log_info "APK 输出目录: build/app/outputs/flutter-apk/"
    ls -la build/app/outputs/flutter-apk/*.apk 2>/dev/null || log_warn "未找到 APK 文件"
}

# 复制构建产物
copy_outputs() {
    log_info "复制构建产物..."
    local OUTPUT_DIR="${PROJECT_ROOT}/output/android"
    mkdir -p "$OUTPUT_DIR"

    cp build/app/outputs/flutter-apk/*.apk "$OUTPUT_DIR/" 2>/dev/null || true

    log_info "构建产物已复制到: ${OUTPUT_DIR}"
}

# 主流程
main() {
    log_info "=== GKD Cloud Client Android 构建开始 ==="

    check_dependencies
    prepare_flclash
    apply_customizations
    apply_branding
    # build_core      # 取消注释以启用核心构建
    # build_flutter   # 取消注释以启用 Flutter 构建
    # copy_outputs

    log_info "=== 构建流程完成 ==="
    log_info "注意：首次构建请取消 build_core 和 build_flutter 的注释"
}

main "$@"
