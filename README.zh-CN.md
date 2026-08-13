# CCUsage Desktop

[English](README.md) | 简体中文

一个本地优先的 Windows Token 用量看板。它把 [ccusage](https://github.com/ccusage/ccusage) 随应用一起打包，将本地 AI 编码工具的用量日志整理为 Tokens、预估费用、模型、工具、项目和会话视图。

[下载最新 Windows 版本](https://github.com/Joe-Bao/ccusage-desktop/releases/latest)

![CCUsage Desktop 总览，显示 Token 指标、每日趋势、模型占用和工具分布](docs/images/dashboard.png)

> 截图使用内置演示数据；桌面应用会读取本机真实 usage 数据。

## 功能

- 今天、最近 7/30/90 天、全部时间与自定义日期范围
- 每日 Token/费用趋势，以及可悬浮或聚焦的完整数值提示
- 每日输入、输出、缓存读取、总 Tokens、费用及范围占比
- 模型和编码工具分布
- Codex 会话标题与项目识别，支持搜索、排序和 Token 构成
- 简体中文 / English，可跟随系统语言
- 深色 / 浅色主题和 Windows 显示缩放适配
- 5 分钟本地结果缓存，刷新失败时可回退到旧缓存

## 安装

1. 从 [Releases](https://github.com/Joe-Bao/ccusage-desktop/releases) 下载 `CCUsage Desktop_*_x64-setup.exe`。
2. 运行安装包。

NSIS 安装包按当前 Windows 用户安装。重复运行新版安装包会原路径覆盖升级，并保留应用数据。

> 当前构建尚未签名，因此 Windows SmartScreen 可能显示警告。

## 隐私与更新

usage 数据始终在本机处理：

- 内置 ccusage 使用离线价格读取本地 usage 文件。
- 不会上传会话、项目、Token 或费用数据。
- 安装后的桌面应用不会启动本地 Web 服务。
- 应用启动时只会匿名请求一次 GitHub 最新 Release 接口，读取版本标签；GitHub 不可用时静默跳过。

检测到更高的稳定版本后，应用会显示可关闭的更新提示，并打开 Releases 页面。下载和安装仍由用户控制，不会在后台自动安装。

## 缓存行为

应用会在 Tauri 缓存目录中保留最多 6 个日期范围的结果：

- 结果未超过 5 分钟时直接返回，不运行 ccusage。
- 缓存不存在或过期时，针对当前日期范围运行 ccusage。
- 不会定时在后台扫描。
- “刷新”会绕过缓存。
- 扫描失败时可以继续显示旧缓存，并给出警告。

ccusage 只扫描受支持工具的本地 usage 目录，不会扫描整块 Windows 硬盘。

## 本地开发

需要：

- Windows 10/11 和 WebView2 Runtime
- Node.js 20+
- pnpm 10
- Rust stable（MSVC）
- Visual Studio Build Tools 的“使用 C++ 的桌面开发”组件

```powershell
pnpm install
pnpm desktop:dev
```

`prepare:sidecar` 会从 ccusage 的可选平台包准备原生 Windows 二进制，不依赖全局安装的 ccusage。

## 验证与构建

```powershell
# TypeScript、前端构建、Node/Rust 测试、格式和 Clippy
pnpm check

# 生成 Windows NSIS 安装包
pnpm desktop:build
```

安装包输出到 `src-tauri/target/release/bundle/nsis/`。

## 发布新版本

1. 同步更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 中的版本号。
2. 运行 `pnpm check` 和 `pnpm desktop:build`。
3. 创建 `vX.Y.Z` 标签和稳定版 GitHub Release。
4. 上传 NSIS 安装包。

应用的稳定版更新检查会忽略草稿和预发布版本。

## 项目结构

- `src/main.ts`：DOM 渲染与交互
- `src/data.ts`：ccusage JSON 校验、统计与会话聚合
- `src/updates.ts`：GitHub Release 查询与版本比较
- `src-tauri/src/lib.rs`：sidecar 调用、Codex 元数据补充与缓存
- `scripts/prepare-sidecar.mjs`：准备原生 ccusage sidecar
- `THIRD_PARTY_NOTICES.md`：随安装包分发的第三方许可

## 许可

ccusage 使用 MIT License，完整文本见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本仓库目前尚未为 CCUsage Desktop 自身声明许可证。
