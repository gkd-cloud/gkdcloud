<?php
/**
 * JA3 Guard — Laravel TrustProxies 中间件
 *
 * 使用方法:
 *   将此文件覆盖到: app/Http/Middleware/TrustProxies.php
 *
 * 作用:
 *   让 Laravel 信任 JA3 Guard 发送的 X-Forwarded-* header，
 *   使 request()->ip()、request()->secure() 等方法返回正确的值。
 *
 *   如果不配置此文件，Laravel 会认为所有请求都是 HTTP（而非 HTTPS），
 *   导致订阅链接使用 http:// 前缀、CSRF 验证失败、重定向循环等问题。
 */

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    /**
     * 受信任的代理 IP
     *
     * 方式一（推荐）: 指定 JA3 Guard 服务器 IP
     *   protected $proxies = ['10.0.0.5'];
     *
     * 方式二: 如果业务服务器只有 JA3 Guard 能访问（如内网或防火墙限制），
     *         可以信任所有来源
     *   protected $proxies = '*';
     */
    protected $proxies = '*';

    /**
     * 信任的 header 映射
     *
     * JA3 Guard 发送以下 header:
     *   X-Forwarded-Proto: https        → 告知上游原始协议是 HTTPS
     *   X-Real-IP: <客户端IP>           → 客户端真实 IP
     *   X-Forwarded-Host: <原始域名>    → 原始请求域名
     */
    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}
