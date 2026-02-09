# GKD Cloud Client (基于 FlClash 魔改)

基于 [FlClash](https://github.com/chen08209/FlClash) 深度定制的跨平台代理客户端，支持 Windows、macOS、Android。

## 核心特性

- **多面板兼容**：原生支持 SSPanel-Metron 和 V2Board 订阅格式
- **自定义 DoH**：支持配置自定义 DNS-over-HTTPS 服务器，防止 DNS 泄露和污染
- **域名伪装**：支持对下发节点域名进行自定义替换/伪装，实现封端避免通报
- **品牌定制**：可自定义应用名称、图标、主题色

## 架构概览

```
flclash-custom/
├── core/                    # Go 核心模块（clash-meta 扩展）
│   ├── subscription/        # 订阅解析与转换
│   │   ├── sspanel.go       # SSPanel-Metron 订阅处理
│   │   ├── v2board.go       # V2Board 订阅处理
│   │   └── converter.go     # 通用转换逻辑
│   ├── dns/                 # DNS 模块
│   │   └── doh.go           # 自定义 DoH 解析器
│   └── masking/             # 域名伪装模块
│       └── domain_mask.go   # 域名替换引擎
├── lib/                     # Flutter/Dart UI 层
│   ├── services/            # 服务层
│   ├── models/              # 数据模型
│   ├── pages/               # 设置页面
│   └── widgets/             # 自定义组件
├── patches/                 # FlClash 源码补丁
├── scripts/                 # 构建脚本
├── config/                  # 默认配置
└── README.md
```

## 工作原理

### 订阅处理流程

```
面板(SSPanel/V2Board)
        ↓
   获取订阅链接
        ↓
  解析节点信息(Base64/JSON)
        ↓
  应用域名伪装规则 ← 自定义域名映射表
        ↓
  注入 DoH 配置   ← 自定义 DoH 服务器
        ↓
  生成 Clash 配置
        ↓
  clash-meta 核心加载
```

### 域名伪装原理

1. 面板下发节点使用真实域名/IP（如 `node1.example.com`）
2. 客户端在获取订阅后，根据预设的映射规则替换域名
3. 替换为 CDN 回源域名或自定义伪装域名（如 `cdn-node1.masked.com`）
4. 配合 SNI/Host 头设置，实现流量伪装
5. 端口也可按规则映射，避免常见端口被封

### 自定义 DoH

- 支持配置多个 DoH 上游（如 Cloudflare、Google、自建）
- 客户端 DNS 查询全部走 HTTPS，防止运营商 DNS 劫持
- 支持 DoH 服务器的自动测速和故障切换

## 构建指南

### 前置要求

- Flutter SDK >= 3.19
- Go >= 1.21
- Android SDK (Android 构建)
- Xcode (macOS 构建)
- Visual Studio / MSVC (Windows 构建)

### 构建步骤

```bash
# 1. 克隆 FlClash 源码
git clone https://github.com/chen08209/FlClash.git
cd FlClash

# 2. 应用自定义补丁
git apply ../flclash-custom/patches/*.patch

# 3. 复制自定义模块
cp -r ../flclash-custom/core/* core/
cp -r ../flclash-custom/lib/* lib/

# 4. 构建目标平台
bash ../flclash-custom/scripts/build_android.sh
bash ../flclash-custom/scripts/build_windows.sh
bash ../flclash-custom/scripts/build_macos.sh
```

## 配置说明

参见 `config/` 目录下的默认配置文件。

## 许可证

基于 FlClash 原始许可证，仅供学习研究使用。
