<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Clash Verge Rev 使用教程 &mdash; {$config["appName"]}</title>
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
                                        <h2 class="text-white font-weight-bold my-2 mr-5">Clash Verge Rev 使用教程</h2>
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
                                                            <p><code>Clash Verge Rev</code> 是基于 <code>Mihomo（Clash.Meta）</code> 内核的开源代理客户端，是原 Clash Verge 项目的社区维护版本，支持 Windows / macOS / Linux。</p>
                                                            <p>支持 ss / vmess / vless / trojan / hysteria2 / tuic 等主流协议，提供托管订阅、规则分流、TUN 模式等高级功能。</p>
                                                            <p>Windows 用户一般选择 <code>x64</code> 版本；M 系列 Mac 用户选择 <code>aarch64</code>；Intel Mac 用户选择 <code>x64</code>。</p>
                                                        </div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_1.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_1.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 1 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 2 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>1. 下载客户端</strong></p>
                                                        <a href="https://app.chongjin01.icu/Windows/clash-verge/clash-verge-rev_x64-setup.exe" class="btn btn-pill btn-clash mb-4" target="_blank">&nbsp;&nbsp;<i class="metron-clash text-white"></i>下载 Clash Verge Rev（Windows x64，推荐）</a>
                                                        <br/>
                                                        <a href="https://app.chongjin01.icu/Windows/clash-verge/clash-verge-rev_arm64-setup.exe" class="btn btn-pill btn-secondary mb-4" target="_blank">下载 Clash Verge Rev（Windows ARM64）</a>
                                                        <div class="h6 pt-3">双击安装包，按提示完成安装后从桌面打开 <code>Clash Verge Rev</code></div>
                                                        <div class="h6 pt-2">
                                                            <span class="text-muted">macOS / Linux 用户请前往
                                                            <a href="https://github.com/clash-verge-rev/clash-verge-rev/releases" target="_blank">GitHub Releases</a> 下载对应版本</span>
                                                        </div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_2.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_2.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 2 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 3 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>2. 导入订阅</strong></p>
                                                        {if in_array('clash',$metron['index_sub'])}
                                                        <div class="btn-group mb-3 mr-3">
                                                            <button type="button" class="btn btn-pill btn-clash dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">&nbsp;&nbsp;<i class="metron-clash text-white"></i>订阅配置&nbsp;&nbsp;</button>
                                                            <div class="dropdown-menu">
                                                                <button type="button" class="dropdown-item copy-text" data-clipboard-text="{$subInfo["clash"]}">复制订阅链接</button>
                                                                <div class="dropdown-divider"></div>
                                                                <button type="button" class="dropdown-item" href="##" onclick="importSublink('clash')">一键导入 Clash Verge</button>
                                                            </div>
                                                        </div>
                                                        {/if}
                                                        <div class="h6 pt-2">点击上方 <strong>一键导入 Clash Verge</strong>，客户端将自动打开并添加订阅</div>
                                                        <div class="h6 pt-2">也可手动操作：复制订阅链接 → 打开客户端 → 左侧点击 <code>订阅</code> 图标 → 点击右上角 <code>新建</code> → 粘贴链接 → 保存</div>
                                                        <div class="h6 pt-2">添加成功后点击订阅卡片右侧的 <code>更新</code> 按钮拉取最新节点</div>
                                                        <div class="h6 pt-2">更新完成后，点击订阅卡片将其设为 <strong>当前使用</strong> 的配置</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_3.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_3.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 3 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 4 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>3. 选择节点</strong></p>
                                                        <div class="h6 pt-2">点击左侧 <code>代理</code> 图标进入代理组界面</div>
                                                        <div class="h6 pt-2">在 <code>节点选择</code> 分组中，点击选择你想使用的节点</div>
                                                        <div class="h6 pt-2">可点击测速按钮（闪电图标）对各节点进行延迟测试，然后选择延迟最低的节点</div>
                                                        <div class="h6 pt-2">也可切换为 <code>自动选择</code> 模式，让客户端自动选择最优节点</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_4.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_4.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 4 -->

                                                <div class="separator separator-dashed separator-border-4"></div>

<!-- 开始 :: 内容段落 5 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <p class="font-size-h1 pb-5"><strong>4. 开启代理</strong></p>
                                                        <div class="h6 pt-2">点击左侧 <code>设置</code> 图标，在 <code>Clash 设置</code> 区域开启 <code>系统代理</code></div>
                                                        <div class="h6 pt-2">开启后系统浏览器及大多数应用流量将自动走代理</div>
                                                        <div class="h6 pt-2">若需代理所有流量（含游戏、命令行工具等），可额外开启 <code>TUN 模式</code>（需管理员权限）</div>
                                                        <div class="h6 pt-2">也可右键任务栏托盘图标快速切换 <code>系统代理</code> 开关</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_5.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/clash-verge/verge_5.png"/></a>
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
        {include file='include/global/import_sublink.tpl'}
        <script src="{$metron['assets_url']}/plugins/tutorial/lightbox/lightbox.min.js" type="text/javascript"></script>

    </body>
</html>
