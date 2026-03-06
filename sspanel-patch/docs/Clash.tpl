<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Mihomo Party 使用教程 &mdash; {$config["appName"]}</title>
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
                                        <h2 class="text-white font-weight-bold my-2 mr-5">Mihomo Party 使用教程</h2>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center">

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
                                                <div class="card-title">
                                                </div>
                                            </div>
                                            <div class="card-body">

<!-- 开始 :: 内容段落 1 -->
                                                <div class="row p-5">

                                                    <!-- 开始 :: 段落文本区 -->
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <!-- 开始 :: 段落标题 -->
                                                        <p class="font-size-h1 pb-5"><strong>0. 简介</strong></p>
                                                        <!-- 结束 :: 段落标题 -->
                                                        <div class="example-preview">
                                                            <p><code>Mihomo Party</code> 是基于 <code>Mihomo</code>（原 Clash.Meta）内核的代理客户端，支持 Windows / macOS / Linux 多平台，支持 ss / vmess / vless / trojan / hysteria2 / tuic 等主流协议及规则分流。</p>
                                                            <p>由于客户端持续更新，界面或功能可能与教程截图存在差异，请以实际界面为准。</p>
                                                            <p><code>Windows x64</code> 版本适合绝大多数用户；若为 32 位系统请选 <code>ia32</code> 版本；Surface Pro X 等 ARM 设备请选 <code>ARM</code> 版本。</p>
                                                        </div>
                                                    </div>
                                                    <!-- 结束 :: 段落文本区 -->

                                                    <!-- 开始 :: 图片 -->
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_1.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_1.png"/></a>
                                                    </div>
                                                    <!-- 结束 :: 图片 -->

                                                </div>
<!-- 结束 :: 内容段落 1 -->

                                                <!-- 开始 :: 分割线 -->
                                                <div class="separator separator-dashed separator-border-4"></div>
                                                <!-- 结束 :: 分割线 -->

<!-- 开始 :: 内容段落 2 -->
                                                <div class="row p-5">
                                                    <!-- 段落内容 -->
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <!-- 开始 :: 段落标题 -->
                                                        <p class="font-size-h1 pb-5"><strong>1. 下载客户端</strong></p>
                                                        <!-- 结束 :: 段落标题 -->
                                                        <!-- 开始 :: 客户端下载按钮 -->
                                                        <a href="https://app.chongjin01.icu/Windows/mihomo-party/mihomo-party-windows-x64-setup.exe" class="btn btn-pill btn-clash mb-4" target="_blank">&nbsp;&nbsp;<i class="metron-clash text-white"></i>下载 Mihomo Party（x64，推荐）</a>&nbsp;&nbsp;&nbsp;
                                                        <br/>
                                                        <a href="https://app.chongjin01.icu/Windows/mihomo-party/mihomo-party-windows-ia32-setup.exe" class="btn btn-pill btn-secondary mb-4" target="_blank">下载 Mihomo Party（ia32，32位系统）</a>&nbsp;&nbsp;&nbsp;
                                                        <a href="https://app.chongjin01.icu/Windows/mihomo-party/mihomo-party-windows-ARM-setup.exe" class="btn btn-pill btn-secondary mb-4" target="_blank">下载 Mihomo Party（ARM）</a>
                                                        <!-- 结束 :: 客户端下载按钮 -->
                                                        <div class="h6 pt-2">下载完成后双击安装包，按提示完成安装，然后从桌面或开始菜单打开 <code>Mihomo Party</code></div>
                                                    </div>
                                                    <!-- 开始 :: 图片 -->
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_2.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_2.png"/></a>
                                                    </div>
                                                    <!-- 结束 :: 图片 -->
                                                </div>
<!-- 结束 :: 内容段落 2 -->

                                                <!-- 开始 :: 分割线 -->
                                                <div class="separator separator-dashed separator-border-4"></div>
                                                <!-- 结束 :: 分割线 -->

<!-- 开始 :: 内容段落 3 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <!-- 开始 :: 段落标题 -->
                                                        <p class="font-size-h1 pb-5"><strong>2. 导入订阅</strong></p>
                                                        <!-- 结束 :: 段落标题 -->
                                                        <!-- 开始 :: 订阅按钮 -->
                                                        {if in_array('clash',$metron['index_sub'])}
                                                        <div class="btn-group mb-3 mr-3">
                                                            <button type="button" class="btn btn-pill btn-clash dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">&nbsp;&nbsp;<i class="metron-clash text-white"></i>订阅配置&nbsp;&nbsp;</button>
                                                            <div class="dropdown-menu">
                                                                <button type="button" class="dropdown-item copy-text" data-clipboard-text="{$subInfo["clash"]}">复制订阅链接</button>
                                                                <div class="dropdown-divider">
                                                                </div>
                                                                <button type="button" class="dropdown-item" href="##" onclick="importSublink('clash')">一键导入 Mihomo Party</button>
                                                            </div>
                                                        </div>
                                                        {/if}
                                                        <!-- 结束 :: 订阅按钮 -->
                                                        <div class="h6 pt-2">点击上方按钮，选择 <code>一键导入 Mihomo Party</code>，客户端将自动打开并添加订阅</div>
                                                        <div class="h6 pt-2">也可复制订阅链接，在 Mihomo Party 的 <code>订阅</code> 页面手动粘贴添加</div>
                                                        <div class="h6 pt-2">添加成功后点击订阅右侧的刷新按钮以更新节点数据</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_3.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_3.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 3 -->

                                                <!-- 开始 :: 分割线 -->
                                                <div class="separator separator-dashed separator-border-4"></div>
                                                <!-- 结束 :: 分割线 -->

<!-- 开始 :: 内容段落 4 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <!-- 开始 :: 段落标题 -->
                                                        <p class="font-size-h1 pb-5"><strong>3. 选择节点</strong></p>
                                                        <!-- 结束 :: 段落标题 -->
                                                        <div class="h6 pt-2">点击左侧 <code>代理</code> 选项进入节点选择界面</div>
                                                        <div class="h6 pt-2">在 <code>节点选择</code> 或 <code>自动选择</code> 分组中，点击选择你想使用的节点</div>
                                                        <div class="h6 pt-2">也可开启 <code>自动选择</code> 让客户端自动测速并选择最快的节点</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_4.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_4.png"/></a>
                                                    </div>
                                                </div>
<!-- 结束 :: 内容段落 4 -->

                                                <!-- 开始 :: 分割线 -->
                                                <div class="separator separator-dashed separator-border-4"></div>
                                                <!-- 结束 :: 分割线 -->

<!-- 开始 :: 内容段落 5 -->
                                                <div class="row p-5">
                                                    <div class="col-sm-12 col-md-12 col-lg-7 pb-5">
                                                        <!-- 开始 :: 段落标题 -->
                                                        <p class="font-size-h1 pb-5"><strong>4. 开启代理</strong></p>
                                                        <!-- 结束 :: 段落标题 -->
                                                        <div class="h6 pt-2">点击左侧 <code>设置</code> 或顶部状态栏，找到 <code>系统代理</code> 开关并开启</div>
                                                        <div class="h6 pt-2">也可右键系统托盘中的 Mihomo Party 图标，选择 <code>系统代理</code> 快速切换</div>
                                                        <div class="h6 pt-2">开启后浏览器等应用即可通过代理访问，一切准备就绪！</div>
                                                    </div>
                                                    <div class="col-sm-12 col-md-12 col-lg-5">
                                                        <a class="image-popup-no-margins" href="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_5.png" data-lightbox="images">
                                                        <img class="rounded-lg" style="width:100%" src="{$metron['assets_url']}/media/tutorial/windows/mihomo/mihomo_5.png"/></a>
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
