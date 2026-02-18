<?php
/**
 * JA3 Guard — 请求验证中间件
 *
 * 使用方法:
 *   1. 将此文件复制到: app/Http/Middleware/JA3GuardMiddleware.php
 *   2. 在 .env 中添加: JA3_GUARD_SECRET=你的guard_secret值
 *   3. 注册中间件（见下方说明）
 *
 * 注册方式（Laravel 不同版本）:
 *
 *   Laravel 11+ (bootstrap/app.php):
 *     ->withMiddleware(function (Middleware $middleware) {
 *         $middleware->append(\App\Http\Middleware\JA3GuardMiddleware::class);
 *     })
 *
 *   Laravel 10 及以下 (app/Http/Kernel.php):
 *     protected $middleware = [
 *         // ... 其他全局中间件
 *         \App\Http\Middleware\JA3GuardMiddleware::class,
 *     ];
 *
 * 作用:
 *   验证请求是否来自 JA3 Guard（通过 X-Guard-Secret header），
 *   防止攻击者绕过 JA3 Guard 直接访问业务服务器。
 *
 *   同时将 X-JA3-Trusted 值注入到 request attributes 中，
 *   方便后续业务逻辑判断客户端是否为可信 TLS 指纹。
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JA3GuardMiddleware
{
    /**
     * 处理传入请求
     */
    public function handle(Request $request, Closure $next): Response
    {
        $secret = env('JA3_GUARD_SECRET', '');

        // 如果配置了 guard_secret，验证请求来源
        if (!empty($secret)) {
            $headerSecret = $request->header('X-Guard-Secret', '');

            if (!hash_equals($secret, $headerSecret)) {
                // 请求不是来自 JA3 Guard，返回 403
                abort(403, 'Forbidden');
            }
        }

        // 将 JA3 信任状态注入 request，供业务逻辑使用
        // 用法: $request->attributes->get('ja3_trusted')  → true / false
        //       $request->attributes->get('ja3_hash')     → JA3 指纹字符串
        $request->attributes->set('ja3_trusted', $request->header('X-JA3-Trusted') === '1');
        $request->attributes->set('ja3_hash', $request->header('X-JA3-Hash', ''));

        return $next($request);
    }
}
