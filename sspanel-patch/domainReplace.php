<?php

/**
 * 域名替换配置
 *
 * 放置位置: config/domainReplace.php
 *
 * 通过 JA3 Guard 服务验证客户端 TLS 指纹，只有受信任的客户端才会收到隐藏域名
 * 未匹配 JA3 指纹的请求一律返回原始域名（宁可错杀，不可放过）
 *
 * 架构: Client → JA3 Guard (Go, 提取 JA3) → Nginx → PHP
 * JA3 Guard 通过 X-JA3-Trusted + X-Guard-Secret header 传递验证结果
 */

return [
    // true = 启用替换, false = 关闭（所有客户端都原样返回）
    'enabled' => true,

    // JA3 Guard 共享密钥（必须与 JA3 Guard config.json 中的 guard_secret 一致）
    // 用于验证请求确实来自 JA3 Guard，防止绕过直连 Nginx 伪造 header
    'guard_secret' => '',

    // 域名映射表
    'mapping' => [
        // 泛域名: *.gnodecn.com 的所有子域名自动替换为 *.gkdnode.net
        // 例: hk1.gnodecn.com → hk1.gkdnode.net, hk2.gnodecn.com → hk2.gkdnode.net
        '*.gnodecn.com' => '*.gkdnode.net',

        // 也可以精确匹配(优先级高于泛域名):
        // 'hk1.gnodecn.com' => 'special.gkdnode.net',
    ],
];
