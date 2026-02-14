#!/bin/bash
# PHP 配置检查脚本 - 宝塔面板环境
# 用法: bash check-php-config.sh

PHP_VER="74"
PHP_DIR="/www/server/php/${PHP_VER}"

echo "====== 服务器资源 ======"
echo "CPU 核心数: $(nproc)"
echo "总内存: $(free -h | awk '/Mem/{print $2}')"
echo "可用内存: $(free -h | awk '/Mem/{print $7}')"
echo ""

echo "====== PHP-FPM 进程池配置 ======"
grep -E "^(pm\.|request_)" ${PHP_DIR}/etc/php-fpm.d/www.conf 2>/dev/null || \
grep -E "^(pm\.|request_)" ${PHP_DIR}/etc/php-fpm.conf 2>/dev/null || \
echo "未找到配置文件"
echo ""

echo "====== PHP 核心配置 ======"
${PHP_DIR}/bin/php -i 2>/dev/null | grep -E "^(memory_limit|max_execution_time|max_input_time|post_max_size|upload_max_filesize|opcache\.(enable|memory|max_accelerated|revalidate))" || \
echo "无法读取 PHP 配置"
echo ""

echo "====== OPcache 状态 ======"
${PHP_DIR}/bin/php -r "if(function_exists('opcache_get_status')){var_dump(opcache_get_status(false));}else{echo 'OPcache 未启用\n';}" 2>/dev/null
echo ""

echo "====== 当前 PHP-FPM 进程数 ======"
ps aux | grep "php-fpm" | grep -v grep | wc -l
echo ""

echo "====== MySQL 连接数 ======"
mysql -u root -p -e "SHOW GLOBAL STATUS LIKE 'Threads_connected';" 2>/dev/null || echo "需要手动检查"
