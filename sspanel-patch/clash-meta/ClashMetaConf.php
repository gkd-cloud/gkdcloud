<?php

namespace App\Utils;

use Symfony\Component\Yaml\Yaml;

/**
 * Mihomo / Clash.Meta 独立订阅渲染器
 *
 * 从 config/clash-meta-template.yaml 读取完整的 Clash YAML 模板，
 * 注入 SSPanel 代理节点后返回可直接下发给客户端的 YAML 字符串。
 *
 * 部署路径：src/Utils/ClashMetaConf.php
 *
 * 与「注入方案」（injectMihomoConfig）的区别：
 *   - 注入方案：在 SSPanel 面板模板基础上追加 dns 节
 *   - 本方案：完全独立的 YAML 模板，与面板模板无关，可完整控制
 *     proxy-groups、rules、dns 的所有配置
 *
 * 当 config/clash-meta-template.yaml 不存在时，render() 返回空字符串，
 * LinkController 会自动降级到注入方案。
 */
class ClashMetaConf
{
    /** 模板文件路径（相对于 SSPanel 根目录） */
    const TEMPLATE_PATH = '/config/clash-meta-template.yaml';

    /** proxy-groups 中代表「所有节点」的占位符 */
    const PROXY_ALL_PLACEHOLDER = '__ALL__';

    /**
     * 渲染 Mihomo 专用 Clash 配置
     *
     * @param object $user   SSPanel 用户对象（用于构建 managed-config URL）
     * @param array  $proxies AppURI::getClashURI() 返回的代理数组列表
     * @return string 完整的 Clash YAML 字符串；模板不存在或解析失败时返回 ''
     */
    public static function render(object $user, array $proxies): string
    {
        $templatePath = BASE_PATH . self::TEMPLATE_PATH;

        if (!file_exists($templatePath)) {
            return '';
        }

        try {
            $config = Yaml::parseFile($templatePath);
        } catch (\Exception $e) {
            return '';
        }

        if (!is_array($config)) {
            return '';
        }

        // ── 注入代理节点 ──────────────────────────────────────────────────────
        $config['proxies'] = $proxies;

        // ── 展开 proxy-groups 中的 __ALL__ 占位符 ─────────────────────────────
        // 提取所有代理名称
        $proxyNames = array_column($proxies, 'name');

        if (isset($config['proxy-groups']) && is_array($config['proxy-groups'])) {
            foreach ($config['proxy-groups'] as &$group) {
                if (empty($group['proxies']) || !is_array($group['proxies'])) {
                    continue;
                }

                $allIdx = array_search(self::PROXY_ALL_PLACEHOLDER, $group['proxies'], true);
                if ($allIdx === false) {
                    continue;
                }

                if (empty($proxyNames)) {
                    // 无节点时移除占位符，保留 DIRECT/REJECT 等非节点条目
                    array_splice($group['proxies'], $allIdx, 1);
                } else {
                    // 用实际节点名称列表替换 __ALL__
                    array_splice($group['proxies'], $allIdx, 1, $proxyNames);
                }
            }
            unset($group);
        }

        // ── 生成 #!MANAGED-CONFIG 注释头（Clash Verge 等托管配置识别标志）─────
        $managedUrl = ($_ENV['baseUrl'] ?? '') . ($_SERVER['REQUEST_URI'] ?? '');
        $header = implode(PHP_EOL, [
            '#!MANAGED-CONFIG ' . $managedUrl . ' interval=86400 strict=false',
            '',
            '#----------------------------------------------------------#',
            '## Mihomo / Clash.Meta 专用配置（由 SSPanel 自动生成）',
            '## 上次更新：' . date('Y-m-d H:i:s'),
            '## 模板：config/clash-meta-template.yaml',
            '#----------------------------------------------------------#',
            '',
        ]);

        return $header . Yaml::dump($config, 4, 2);
    }
}
