#!/bin/bash

# Soga 权限问题诊断脚本
# 使用方法: bash diagnose-soga.sh [实例名]

INSTANCE_NAME="${1:-soga-test}"
SOGA_DIR="/etc/soga/${INSTANCE_NAME}"
SOGA_BIN="${SOGA_DIR}/soga"

echo "======================================"
echo "Soga 权限问题诊断"
echo "实例名称: ${INSTANCE_NAME}"
echo "======================================"
echo

echo "1. 检查文件是否存在"
if [ -f "$SOGA_BIN" ]; then
    echo "✓ 文件存在: $SOGA_BIN"
else
    echo "✗ 文件不存在: $SOGA_BIN"
    exit 1
fi
echo

echo "2. 检查文件权限"
ls -lh "$SOGA_BIN"
echo

echo "3. 检查文件类型"
file "$SOGA_BIN"
echo

echo "4. 检查文件系统挂载选项"
echo "检查 /etc 是否有 noexec 选项："
mount | grep -E "^.* on /etc " | grep -o "noexec" && echo "✗ 发现 noexec 选项！这会阻止执行" || echo "✓ 没有 noexec 选项"
mount | grep -E "^.* on / " | grep -o "noexec" && echo "✗ 根目录有 noexec 选项！" || echo "✓ 根目录没有 noexec 选项"
echo

echo "5. 检查 SELinux 状态"
if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce)
    echo "SELinux 状态: $SELINUX_STATUS"
    if [ "$SELINUX_STATUS" = "Enforcing" ]; then
        echo "⚠ SELinux 处于强制模式，可能阻止执行"
        echo "文件的 SELinux 上下文："
        ls -Z "$SOGA_BIN"
    fi
else
    echo "✓ SELinux 未安装"
fi
echo

echo "6. 尝试手动执行"
echo "执行: $SOGA_BIN --version"
"$SOGA_BIN" --version 2>&1
if [ $? -eq 0 ]; then
    echo "✓ 可以执行"
else
    echo "✗ 无法执行，错误码: $?"
fi
echo

echo "7. 检查可执行位"
if [ -x "$SOGA_BIN" ]; then
    echo "✓ 文件有可执行位"
else
    echo "✗ 文件没有可执行位"
    echo "尝试修复："
    chmod +x "$SOGA_BIN"
    echo "chmod +x $SOGA_BIN"
    ls -lh "$SOGA_BIN"
fi
echo

echo "8. 检查文件头（ELF 魔数）"
hexdump -C "$SOGA_BIN" | head -1
HEADER=$(hexdump -C "$SOGA_BIN" | head -1 | awk '{print $2$3$4$5}')
if [ "$HEADER" = "7f454c46" ]; then
    echo "✓ 这是一个有效的 ELF 可执行文件"
else
    echo "✗ 这不是一个有效的 ELF 文件（头部：$HEADER）"
    echo "文件可能损坏或不是正确的二进制文件"
fi
echo

echo "9. 检查架构兼容性"
SYSTEM_ARCH=$(uname -m)
FILE_ARCH=$(file "$SOGA_BIN" | grep -oP "(?<=ELF )\d+-bit")
echo "系统架构: $SYSTEM_ARCH"
echo "文件架构: $FILE_ARCH"
echo

echo "10. 检查 systemd 服务状态"
systemctl status "soga-${INSTANCE_NAME}" --no-pager -l
echo

echo "======================================"
echo "诊断完成"
echo "======================================"
echo
echo "建议的修复步骤："
echo "1. 如果有 noexec 问题："
echo "   sudo mount -o remount,exec /etc"
echo
echo "2. 如果是 SELinux 问题："
echo "   sudo chcon -t bin_t $SOGA_BIN"
echo "   # 或临时禁用 SELinux: sudo setenforce 0"
echo
echo "3. 如果文件损坏："
echo "   # 删除实例并重新创建"
echo
echo "4. 如果没有执行权限："
echo "   sudo chmod +x $SOGA_BIN"
echo "   sudo systemctl restart soga-${INSTANCE_NAME}"
