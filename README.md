# CCUsage Desktop

一个本地优先的 Windows Token 用量看板。它把 [ccusage](https://github.com/ryoppippi/ccusage) 作为随应用分发的 sidecar，通过 Tauri 2 + WebView2 展示每日用量、费用、模型/工具分布，以及可展开的会话 Token 构成。

## 特性

- 总览：今天/预设/自定义日期、费用、总 Tokens、缓存占比、峰值日和每日趋势
- 每日明细：按日期、工具和模型查看输入、输出、缓存与费用
- 会话分析：显示 Codex 标题与项目，支持搜索、排序、占用率和 Token 构成
- 精确提示：悬浮或键盘聚焦趋势点、模型和工具分布即可查看完整 Tokens、占比与费用
- 多语言：跟随系统语言，亦可在设置中切换简体中文或 English
- 本地缓存：5 分钟 TTL、最多 6 个时间范围、原子写入、刷新失败时回退旧缓存
- 本地处理：前端不能直接执行命令，只有 Rust 后端可调用打包后的 ccusage
- UTF-8 安全：中文路径、会话名和 emoji 可完整往返
- 响应式界面：支持 900 × 620 起的 Windows 窗口及系统浅色/深色主题

应用不需要服务端，也不会上传使用记录。费用使用 ccusage 的离线价格数据估算。

## 开发环境

- Windows 10/11 与 WebView2 Runtime（Windows 11 通常已自带）
- Node.js 20 或更高版本
- pnpm 10
- Rust stable，目标为 MSVC
- Visual Studio Build Tools 的“使用 C++ 的桌面开发”组件

```powershell
pnpm install
pnpm desktop:dev
```

`prepare:sidecar` 会从 ccusage 的官方可选平台包复制原生 Windows 二进制，不依赖用户全局安装 ccusage。

## 验证与构建

```powershell
# TypeScript、前端构建、Node/Rust 测试、格式和 Clippy
pnpm check

# 生成 NSIS 与 MSI 安装包
pnpm desktop:build
```

构建产物位于：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

默认构建未进行 Windows 代码签名。公开分发前应使用可信证书签名安装包和可执行文件，以避免 SmartScreen 警告。

## 缓存行为

缓存文件位于 `%LOCALAPPDATA%\app.ccusage.desktop\usage-v1.json`：

- 普通启动和切换范围会优先读取 5 分钟内的缓存
- “刷新”会绕过缓存并重新扫描
- 扫描失败时，如果存在旧缓存，界面会继续显示旧数据并提示原因
- 设置页可以清除缓存；清除后会立即重新扫描

## 项目结构

- `src/main.ts`：安全 DOM 渲染与交互
- `src/data.ts`：JSON 校验、统计与会话聚合
- `src-tauri/src/lib.rs`：sidecar 调用、请求校验和持久缓存
- `scripts/prepare-sidecar.mjs`：准备当前 Windows 架构的 ccusage 二进制
- `THIRD_PARTY_NOTICES.md`：随安装包分发的第三方许可

## 许可

ccusage 的 MIT 许可文本见 `THIRD_PARTY_NOTICES.md`。本项目自身尚未声明开源许可。
