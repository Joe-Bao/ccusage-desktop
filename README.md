# CCUsage Desktop

一个本地优先的 Windows Token 用量看板。它把 [ccusage](https://github.com/ccusage/ccusage) 随应用一起打包，通过 Tauri 2 + WebView2 展示用量、费用、模型、工具、项目和会话。

[下载最新 Windows 安装包](https://github.com/Joe-Bao/ccusage-desktop/releases/latest)

## 功能

- 今天、最近 7/30/90 天、全部时间与自定义日期范围
- 每日趋势、完整数值悬浮提示、模型与工具分布
- 每日输入、输出、缓存读取、总 Tokens、费用及范围占比
- Codex 会话标题与项目识别，会话搜索、排序和 Token 构成
- 简体中文 / English，可跟随系统语言
- 5 分钟本地缓存；刷新失败时可回退到旧缓存
- 深色 / 浅色主题和 Windows 显示缩放适配

所有 usage 文件都在本机读取，应用不会上传会话、项目、Token 或费用数据。费用由 ccusage 的离线价格快照估算。

## 安装与更新

当前构建提供 Windows NSIS 用户级安装包。同一 Windows 用户重复运行新版安装包即可覆盖升级，并继续使用原有应用数据。

应用启动后会匿名请求 GitHub 的 `latest Release` 接口：

- 只读取最新稳定版的版本标签，不发送本地 usage 数据
- 只有远端版本高于当前版本时才显示更新提示
- 点击提示会打开 GitHub Releases 页面，由用户下载并运行安装包
- 网络不可用、接口限流或尚无 Release 时静默跳过，不影响本地数据加载

这不是后台静默安装器。每个版本必须发布为 GitHub Release（建议标签格式 `vX.Y.Z`）并附上安装包，已安装客户端才能发现它。

> 未签名的开发构建可能触发 Windows SmartScreen。公开分发时建议使用可信代码签名证书。

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

`prepare:sidecar` 会从 ccusage 的官方可选平台包准备原生 Windows 二进制，不依赖全局安装的 ccusage。

## 验证与构建

```powershell
# TypeScript、前端构建、Node/Rust 测试、格式和 Clippy
pnpm check

# 生成 NSIS 安装包
pnpm desktop:build
```

安装包输出到 `src-tauri/target/release/bundle/nsis/`。默认构建不包含代码签名。

## 发布新版本

1. 同步更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 中的版本号。
2. 运行 `pnpm check` 和 `pnpm desktop:build`。
3. 创建 `vX.Y.Z` 标签并发布 GitHub Release。
4. 上传 `src-tauri/target/release/bundle/nsis/` 下的安装包。

草稿和预发布版不会被客户端的稳定版更新检查选中。

## 缓存

缓存文件名为 `usage-v1.json`，位于 Tauri 的应用缓存目录中。缓存最多保留 6 个日期范围，5 分钟内优先复用；“刷新”会绕过缓存。设置页可以清除缓存并立即重新扫描。

## 项目结构

- `src/main.ts`：DOM 渲染与交互
- `src/data.ts`：ccusage JSON 校验、统计与会话聚合
- `src/updates.ts`：GitHub Release 查询与版本比较
- `src-tauri/src/lib.rs`：sidecar 调用、Codex 元数据补充与缓存
- `scripts/prepare-sidecar.mjs`：准备当前 Windows 架构的 ccusage 二进制
- `THIRD_PARTY_NOTICES.md`：随安装包分发的第三方许可

## 许可

ccusage 使用 MIT License，完整文本见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目自身目前尚未声明开源许可证。
