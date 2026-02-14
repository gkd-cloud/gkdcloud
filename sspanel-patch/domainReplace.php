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
 * 支持泛域名: '*.old.com' => '*.new.com' 自动匹配所有子域名
 * 精确匹配优先于泛域名匹配
 * 可添加多条规则，每条独立生效
 */

return [
    // true = 启用替换, false = 关闭（所有客户端都原样返回）
    'enabled' => true,

    // 域名映射表
    'mapping' => [
        // 泛域名: *.gnodecn.com 的所有子域名自动替换为 *.gkdnode.net
        // 例: hk1.gnodecn.com → hk1.gkdnode.net, hk2.gnodecn.com → hk2.gkdnode.net
        '*.gnodecn.com' => '*.gkdnode.net',

        // 也可以精确匹配(优先级高于泛域名):
        // 'hk1.gnodecn.com' => 'special.gkdnode.net',
    ],
];
