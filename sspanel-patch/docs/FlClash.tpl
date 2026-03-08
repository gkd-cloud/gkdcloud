<!DOCTYPE html>
<html lang="en">
    <head>
        <title>FlClash 使用教程 &mdash; {$config["appName"]}</title>
        <link href="{$metron['assets_url']}/css/client/metron-icon.css" rel="stylesheet" type="text/css" />
        <link href="{$metron['assets_url']}/plugins/tutorial/lightbox/lightbox.min.css" rel="stylesheet" >
        {include file='include/global/head.tpl'}
        <div class="d-flex flex-column flex-root">
            <div class="d-flex flex-row flex-column-fluid page">
                <div class="d-flex flex-column flex-row-fluid wrapper" id="kt_wrapper">
                    {include file='include/global/menu.tpl'}
                    <div class="content d-flex flex-column flex-column-fluid" id="kt_content">
                        <div class="subheader min-h-lg-175px pt-5 pb-7 subheader-transparent" id="kt_subheader">
                            <div class="container d-flex align-items-center justify-content-between flex-wrap flex-sm-nowrap">
                                <div class="d-flex align-items-center flex-wrap mr-2">
                                    <div class="d-flex flex-column">
                                        <h2 class="text-white font-weight-bold my-2 mr-5">FlClash 使用教程</h2>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="d-flex flex-column-fluid">
                            <div class="container">

                                <!-- 开始 :: 教程内容 -->
                                <div class="row" data-sticky-container>
                                    <div class="col-12">
                                        <div class="card card-custom gutter-b {$metron['style_shadow']}">
                                            <div class="card-header">
                                                <div class="card-title"></div>
                                            </div>
                                            <div class="card-body">

<!-- 开始 :: 内容段落 1 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>0. 简介</strong></p>
                                                        <div class="example-preview">
                                                            <p><code>FlClash</code> 是基于 <code>Mihomo（Clash.Meta）</code> 内核、采用 Flutter 构建的跨平台代理客户端，界面简洁美观，支持 Windows / macOS / Android / Linux。</p>
                                                            <p>支持 ss / vmess / vless / trojan / hysteria2 / tuic 等主流协议，提供自动选择、延迟测试、规则分流等功能。</p>
                                                            <p>本站提供经过定制优化的 FlClash 版本，内置更好的 DNS 配置与节点连接体验。</p>
                                                        </div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_1.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_1.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 1 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 2 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>1. 下载客户端</strong></p>
                                                        <a href="https://app.chongjin01.icu/Windows/FLClash/FlClash--windows-amd64-setup.exe" class="btn btn-pill btn-clash mb-4" target="_blank">&nbsp;&nbsp;<i class="metron-clash text-white"></i>下载 FlClash（Windows x64，推荐）</a>
                                                        <br/>
                                                        <div class="h6 pt-2 text-warning">安装时若出现报错，请先安装运行库：<a href="https://423down.lanzouo.com/iZF4Q378w2le" target="_blank">点击下载运行库</a>，安装完成后重试</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_2.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_2.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 2 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 3 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>2. 导入订阅</strong></p>
                                                        {if in_array('clash',$metron['index_sub'])}
                                                        <button type="button" class="btn btn-pill btn-clash mb-3 copy-text" data-clipboard-text="{$subInfo["clash"]}">&nbsp;&nbsp;<i class="metron-clash text-white"></i>复制订阅链接</button>
                                                        {/if}
                                                        <div class="h6 pt-2">复制订阅链接后，打开 FlClash → 点击左侧 <code>配置</code> → 点击右下角 <strong>+</strong> 按钮 → 选择 <code>从 URL 导入</code> → 粘贴链接 → 确认</div>
                                                        <div class="h6 pt-2">导入后点击配置卡片旁的刷新图标更新节点，然后点击卡片将其设为当前配置</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_3.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_3.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 3 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 4 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>3. 选择节点</strong></p>
                                                        <div class="h6 pt-2">点击左侧 <code>代理</code> 进入节点选择界面</div>
                                                        <div class="h6 pt-2">在 <code>节点选择</code> 分组中点击选择目标节点</div>
                                                        <div class="h6 pt-2">点击分组右上角的测速图标，可对该组内所有节点进行延迟测试</div>
                                                        <div class="h6 pt-2">推荐将 <code>节点选择</code> 切换为 <code>自动选择</code>，FlClash 会自动测速并选择延迟最低的节点</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_4.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_4.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 4 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 5 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>4. 开启代理</strong></p>
                                                        <div class="h6 pt-2">点击左侧 <code>工具</code> 或顶部开关区域，开启 <code>系统代理</code></div>
                                                        <div class="h6 pt-2">Windows 用户也可在任务栏右下角找到 FlClash 托盘图标，右键快速切换代理模式</div>
                                                        <div class="h6 pt-2">若需接管所有流量（含游戏、命令行工具等），可在 <code>设置</code> 中开启 <code>TUN 模式</code>（需管理员权限）</div>
                                                        <div class="h6 pt-2">一切准备就绪，现在可以正常访问了！</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_5.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/flclash/flclash_5.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 5 -->

                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- 结束 :: 教程内容 -->

                            </div>
                        </div>
                    </div>
                    {include file='include/global/footer.tpl'}
                </div>
            </div>
        </div>

        {include file='include/global/scripts.tpl'}
        <script src="{$metron['assets_url']}/plugins/tutorial/lightbox/lightbox.min.js" type="text/javascript"></script>

    </body>
</html>
