<?php

/**
 * DomainReplacer — 订阅节点域名替换工具
 *
 * 放置位置: src/Utils/DomainReplacer.php
 * 命名空间: App\Utils
 *
 * 功能: 解析 Base64 编码的订阅内容，按配置把节点连接域名替换为指定域名
 * 支持协议: vmess / ss / ssr / trojan / vless / hysteria2(hy2)
 * 安全: 由 JA3 Guard (Go 服务) 在 TLS 层验证客户端指纹，PHP 只需检查信任 header
 */

declare(strict_types=1);

namespace App\Utils;

final class DomainReplacer
{
    /** @var array<string, string> 旧域名 => 新域名 */
    private array $mapping;

    public function __construct(array $mapping)
    {
        $this->mapping = $mapping;
    }

    // ============================================================
    //  对外入口
    // ============================================================

    /**
     * 从配置文件加载域名映射表
     * 配置路径: config/domainReplace.php（返回数组）
     */
    public static function loadMapping(): array
    {
        $file = BASE_PATH . '/config/domainReplace.php';
        if (!file_exists($file)) {
            return [];
        }
        $config = require $file;
        return $config['mapping'] ?? [];
    }

    /**
     * 替换 Base64 编码订阅中的节点域名
     *
     * @param string $base64Content Base64 编码的订阅原文
     * @return string 替换后重新 Base64 编码的内容
     */
    public function replaceBase64(string $base64Content): string
    {
        $decoded = base64_decode($base64Content, true);
        if ($decoded === false) {
            return $base64Content; // 解码失败原样返回
        }

        $lines = explode("\n", $decoded);
        $modified = array_map(fn(string $line) => $this->processLine(trim($line)), $lines);
        return base64_encode(implode("\n", $modified));
    }

    // ============================================================
    //  内部方法
    // ============================================================

    private function replaceDomain(string $domain): string
    {
        // 精确匹配优先
        if (isset($this->mapping[$domain])) {
            return $this->mapping[$domain];
        }

        // 泛域名匹配: '*.old.com' => '*.new.com'
        foreach ($this->mapping as $pattern => $replacement) {
            if (str_starts_with($pattern, '*.')) {
                $suffix = substr($pattern, 2); // old.com
                if (str_ends_with($domain, '.' . $suffix)) {
                    $sub = substr($domain, 0, -(strlen($suffix) + 1)); // hk1
                    if (str_starts_with($replacement, '*.')) {
                        return $sub . '.' . substr($replacement, 2);
                    }
                    return $replacement; // 固定替换，不保留子域名
                }
            }
        }

        return $domain;
    }

    private function processLine(string $line): string
    {
        if ($line === '') {
            return $line;
        }

        // 根据协议前缀分发
        if (str_starts_with($line, 'vmess://'))     return $this->modifyVmess($line);
        if (str_starts_with($line, 'ssr://'))       return $this->modifySSR($line);
        if (str_starts_with($line, 'ss://'))         return $this->modifySS($line);
        if (str_starts_with($line, 'trojan://'))     return $this->modifyStandard($line, 'trojan://');
        if (str_starts_with($line, 'vless://'))      return $this->modifyStandard($line, 'vless://');
        if (str_starts_with($line, 'hysteria2://'))  return $this->modifyStandard($line, 'hysteria2://');
        if (str_starts_with($line, 'hy2://'))        return $this->modifyStandard($line, 'hy2://');

        return $line;
    }

    /**
     * vmess://base64(JSON)
     * JSON 中 "add" 字段为服务器地址
     */
    private function modifyVmess(string $line): string
    {
        $encoded = substr($line, 8); // 去掉 vmess://
        $json = json_decode(base64_decode($encoded, true) ?: '', true);
        if (!is_array($json) || !isset($json['add'])) {
            return $line;
        }

        $json['add'] = $this->replaceDomain($json['add']);
        return 'vmess://' . base64_encode(json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /**
     * ssr://base64(server:port:protocol:method:obfs:password_base64/?params)
     */
    private function modifySSR(string $line): string
    {
        $encoded = substr($line, 6); // 去掉 ssr://
        $decoded = base64_decode(str_replace(['-', '_'], ['+', '/'], $encoded), true);
        if ($decoded === false) {
            return $line;
        }

        $colonPos = strpos($decoded, ':');
        if ($colonPos === false) {
            return $line;
        }

        $server = substr($decoded, 0, $colonPos);
        $rest = substr($decoded, $colonPos);
        $modified = $this->replaceDomain($server) . $rest;

        // SSR 使用 URL-safe base64
        $b64 = base64_encode($modified);
        $b64 = str_replace(['+', '/', '='], ['-', '_', ''], $b64);
        return 'ssr://' . $b64;
    }

    /**
     * ss://base64@server:port#name  或  ss://base64(method:pass@server:port)#name
     */
    private function modifySS(string $line): string
    {
        $rest = substr($line, 5); // 去掉 ss://

        // 分离 #节点名称
        $fragment = '';
        $hashPos = strrpos($rest, '#');
        if ($hashPos !== false) {
            $fragment = substr($rest, $hashPos);
            $rest = substr($rest, 0, $hashPos);
        }

        $atPos = strpos($rest, '@');
        if ($atPos !== false) {
            // 格式: userinfo@server:port
            $userInfo = substr($rest, 0, $atPos);
            $serverPart = substr($rest, $atPos + 1);
            $colonPos = strrpos($serverPart, ':');
            if ($colonPos !== false) {
                $server = substr($serverPart, 0, $colonPos);
                $port = substr($serverPart, $colonPos);
                return 'ss://' . $userInfo . '@' . $this->replaceDomain($server) . $port . $fragment;
            }
        } else {
            // 整体 base64: ss://base64(method:pass@server:port)
            $decoded = base64_decode($rest, true);
            if ($decoded !== false) {
                $dAtPos = strrpos($decoded, '@');
                if ($dAtPos !== false) {
                    $cred = substr($decoded, 0, $dAtPos);
                    $sp = substr($decoded, $dAtPos + 1);
                    $colonPos = strrpos($sp, ':');
                    if ($colonPos !== false) {
                        $server = substr($sp, 0, $colonPos);
                        $port = substr($sp, $colonPos);
                        $modified = $cred . '@' . $this->replaceDomain($server) . $port;
                        return 'ss://' . base64_encode($modified) . $fragment;
                    }
                }
            }
        }

        return $line;
    }

    /**
     * 通用 URI 格式: scheme://userinfo@server:port?query#fragment
     * 适用于 trojan / vless / hysteria2 / hy2
     */
    private function modifyStandard(string $line, string $scheme): string
    {
        $rest = substr($line, strlen($scheme));

        // 分离 #fragment
        $fragment = '';
        $hashPos = strpos($rest, '#');
        if ($hashPos !== false) {
            $fragment = substr($rest, $hashPos);
            $rest = substr($rest, 0, $hashPos);
        }

        // 分离 ?query
        $query = '';
        $qPos = strpos($rest, '?');
        if ($qPos !== false) {
            $query = substr($rest, $qPos);
            $rest = substr($rest, 0, $qPos);
        }

        // 分离 userinfo@server:port
        $atPos = strpos($rest, '@');
        if ($atPos === false) {
            return $line;
        }

        $userInfo = substr($rest, 0, $atPos);
        $serverPart = substr($rest, $atPos + 1);

        // 处理 IPv6 [::1]:port
        if (str_starts_with($serverPart, '[')) {
            $bEnd = strpos($serverPart, ']');
            $server = substr($serverPart, 0, $bEnd + 1);
            $port = substr($serverPart, $bEnd + 1);
        } else {
            $colonPos = strrpos($serverPart, ':');
            $server = $colonPos !== false ? substr($serverPart, 0, $colonPos) : $serverPart;
            $port = $colonPos !== false ? substr($serverPart, $colonPos) : '';
        }

        return $scheme . $userInfo . '@' . $this->replaceDomain($server) . $port . $query . $fragment;
    }
}
