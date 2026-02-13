<?php

/**
 * 域名替换配置
 *
 * 放置位置: config/domainReplace.php
 *
 * 当 Shadowrocket 客户端请求订阅时，节点中的旧域名会被替换为新域名
 * 其他客户端不受影响，原样返回
 *
 * 用法: 在 mapping 中添加 '旧域名' => '新域名'
 * 可添加多条规则，每条独立生效
 */

return [
    // true = 启用替换, false = 关闭（所有客户端都原样返回）
    'enabled' => true,

    // 域名映射表
    'mapping' => [
        // 示例: 把节点中的 hk1.old-domain.com 替换为 hk1.new-domain.com
        // 'hk1.old-domain.com' => 'hk1.new-domain.com',
        // 'us1.old-domain.com' => 'us1.new-domain.com',
    ],
];
