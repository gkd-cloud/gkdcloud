<?php

/**
 * 域名替换配置
 *
 * 放置位置: config/domainReplace.php
 *
 * 通过 JA3 TLS 指纹白名单验证客户端身份，只有受信任的客户端才会收到隐藏域名
 * 未匹配 JA3 指纹的请求一律返回原始域名（宁可错杀，不可放过）
 *
 * 用法: 在 mapping 中添加 '旧域名' => '新域名'
 * 支持泛域名: '*.old.com' => '*.new.com' 自动匹配所有子域名
 * 精确匹配优先于泛域名匹配
 *
 * JA3 指纹获取方式:
 *   1. Web 服务器（Nginx/HAProxy/Cloudflare）提取 JA3 hash 并传递为 HTTP header
 *   2. 用真实 iOS 设备的 Shadowrocket 请求一次订阅
 *   3. 从 Web 服务器日志中提取该请求的 JA3 hash，填入 trusted 列表
 *
 * Web 服务器配置示例:
 *   Nginx (需 ja3 模块):  proxy_set_header X-JA3-Hash $http_ssl_ja3_hash;
 *   HAProxy 2.6+:          http-request set-header X-JA3-Hash %[ssl_fc_ja3]
 *   Cloudflare:             自动提供，header 名填 Cf-JA3-Hash
 */

return [
    // true = 启用替换, false = 关闭（所有客户端都原样返回）
    'enabled' => true,

    // JA3 TLS 指纹验证配置
    'ja3' => [
        // JA3 hash 来源的 HTTP header 名称（由 Web 服务器设置）
        // Nginx ja3 模块: 'X-JA3-Hash'
        // HAProxy:        'X-JA3-Hash'
        // Cloudflare:     'Cf-JA3-Hash'
        'header' => 'X-JA3-Hash',

        // 受信任的 JA3 指纹白名单（严格匹配，区分大小写）
        // 只有匹配的请求才会收到隐藏域名，其余一律返回正常域名
        // 留空 = 所有请求都返回正常域名（等同于关闭替换）
        'trusted' => [
            // 在此添加你从真实 iOS 设备收集到的 JA3 hash
            // 'e7d705a3286e19ea42f587b344ee6865', // 示例: iOS 16 Shadowrocket
            // 'b32309a26951912be7dba376398abc3b', // 示例: iOS 17 Shadowrocket
        ],
    ],

    // 域名映射表
    'mapping' => [
        // 泛域名: *.gnodecn.com 的所有子域名自动替换为 *.gkdnode.net
        // 例: hk1.gnodecn.com → hk1.gkdnode.net, hk2.gnodecn.com → hk2.gkdnode.net
        '*.gnodecn.com' => '*.gkdnode.net',

        // 也可以精确匹配(优先级高于泛域名):
        // 'hk1.gnodecn.com' => 'special.gkdnode.net',
    ],
];
