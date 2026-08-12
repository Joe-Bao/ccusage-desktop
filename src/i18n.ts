export type Locale = "zh-CN" | "en";
export type LanguagePreference = "system" | Locale;

const zh = {
  "nav.main": "主导航",
  "nav.overview": "总览",
  "nav.daily": "每日",
  "nav.sessions": "会话",
  "nav.settings": "设置",
  "status.connecting": "正在连接数据",
  "status.firstRead": "准备首次读取…",
  "range.group": "时间范围",
  "range.today": "今天",
  "range.7d": "7 天",
  "range.30d": "30 天",
  "range.90d": "90 天",
  "range.all": "全部",
  "range.custom": "自定义",
  "range.label.7d": "最近 7 天",
  "range.label.30d": "最近 30 天",
  "range.label.90d": "最近 90 天",
  "range.label.all": "全部时间",
  "common.refresh": "刷新",
  "common.loading": "读取中",
  "common.cancel": "取消",
  "common.apply": "应用范围",
  "common.cost": "费用",
  "common.totalTokens": "总 Tokens",
  "common.noData": "所选范围内暂无数据",
  "banner.preview": "浏览器预览模式：桌面应用会读取本机真实 ccusage 数据。",
  "dialog.custom.title": "自定义日期",
  "dialog.custom.description": "起止日期均包含在统计范围内。",
  "dialog.startDate": "开始日期",
  "dialog.endDate": "结束日期",
  "overview.trend": "趋势",
  "overview.dailyUsage": "每日消耗",
  "overview.metric": "趋势指标",
  "overview.chartLabel": "每日消耗趋势图",
  "overview.model": "模型",
  "overview.modelUsage": "模型占用",
  "overview.source": "来源",
  "overview.toolDistribution": "工具分布",
  "daily.title": "逐日明细",
  "daily.date": "日期",
  "daily.source": "来源",
  "daily.model": "模型",
  "daily.input": "输入",
  "daily.output": "输出",
  "daily.cacheRead": "缓存读取",
  "daily.empty": "所选范围内暂无每日记录",
  "daily.shareHelp": "此日 Tokens 占当前所选时间范围总 Tokens 的比例",
  "sessions.title": "会话占用率",
  "sessions.search": "搜索会话",
  "sessions.searchPlaceholder": "搜索标题、项目、ID 或模型",
  "sessions.sort": "会话排序",
  "sessions.sort.tokens": "按 Tokens",
  "sessions.sort.cost": "按费用",
  "sessions.sort.latest": "按最近活动",
  "sessions.loadMore": "显示更多",
  "sessions.empty": "没有匹配的会话",
  "settings.cache.title": "本地缓存",
  "settings.cache.description": "结果保存在应用缓存目录，5 分钟内重复查看不会重新扫描 usage 文件。",
  "settings.currentStatus": "当前状态",
  "settings.generatedAt": "生成时间",
  "settings.duration": "响应耗时",
  "settings.clearCache": "清除缓存",
  "settings.privacy.title": "完全本地",
  "settings.privacy.description": "数据由内置 ccusage 离线读取，不启动本地服务器，也不会上传会话或费用信息。",
  "settings.pricingMode": "价格模式",
  "settings.offlineSnapshot": "离线快照",
  "settings.runtime": "桌面运行时",
  "settings.license": "许可证",
  "settings.language": "界面语言",
  "settings.language.system": "跟随系统",
  "settings.language.zh": "简体中文",
  "settings.language.en": "English",
  "settings.sources.title": "检测到的数据源",
  "view.overview.eyebrow": "USAGE PULSE",
  "view.overview.title": "用量总览",
  "view.overview.subtitle": "本机所有 AI 编码工具的 Token 与费用",
  "view.daily.eyebrow": "DAILY LEDGER",
  "view.daily.title": "每日明细",
  "view.daily.subtitle": "观察每日消耗、缓存利用与模型变化",
  "view.sessions.eyebrow": "SESSION SHARE",
  "view.sessions.title": "会话分析",
  "view.sessions.subtitle": "定位占用最高的会话并展开 Token 构成",
  "view.settings.eyebrow": "LOCAL FIRST",
  "view.settings.title": "设置",
  "view.settings.subtitle": "缓存、运行时与本地数据源状态",
  "time.unknown": "未知时间",
  "kpi.estimatedCost": "预估费用",
  "kpi.offlinePrice": "{range} · 离线价格",
  "kpi.totalTokens": "总 Tokens",
  "kpi.dailyAverage": "日均 {tokens}",
  "kpi.cacheShare": "缓存占比",
  "kpi.cacheReads": "{tokens} 缓存读取",
  "kpi.peakDay": "峰值日",
  "kpi.noActivity": "暂无活跃记录",
  "distribution.empty": "暂无分布数据",
  "chart.summary": "合计 {total} · 峰值 {date}",
  "daily.activeDays": "{count} 个活跃日",
  "sessions.count": "会话数量",
  "sessions.activeWithin": "{range}内有活动",
  "sessions.largest": "最大单会话占用",
  "sessions.none": "暂无会话",
  "sessions.topFive": "Top 5 集中度",
  "sessions.topFiveMeta": "前五个会话占全部 Tokens",
  "sessions.unknownModel": "未知模型",
  "sessions.allShare": "占全部会话",
  "sessions.project": "项目",
  "sessions.cwd": "工作目录",
  "sessions.inputTokens": "输入 Tokens",
  "sessions.outputTokens": "输出 Tokens",
  "sessions.reasoningTokens": "推理 Tokens",
  "sessions.models": "模型",
  "sessions.mixHelp": "输入 / 输出 / 缓存读取 / 缓存创建 · 缓存占比 {share}",
  "sessions.moreRemaining": "显示更多（剩余 {count}）",
  "cache.stale": "旧缓存（刷新失败）",
  "cache.hit": "缓存命中 · {seconds} 秒前",
  "cache.new": "已写入新缓存",
  "cache.cleared": "缓存已清除",
  "sources.none": "暂未检测到活跃来源",
  "status.sourcesReady": "{count} 个数据源已就绪",
  "status.ready": "数据源已就绪",
  "status.cacheResponse": "缓存响应 {duration} ms · {range}",
  "status.scanComplete": "扫描完成 {duration} ms · {range}",
  "status.readFailed": "数据读取失败",
  "status.checkFiles": "请检查本机 usage 文件",
  "error.date.missing": "请选择自定义起止日期",
  "error.date.invalid": "请选择有效的起止日期",
  "error.date.reversed": "开始日期不能晚于结束日期",
} as const;

export type MessageKey = keyof typeof zh;

const en: Record<MessageKey, string> = {
  "nav.main": "Main navigation",
  "nav.overview": "Overview",
  "nav.daily": "Daily",
  "nav.sessions": "Sessions",
  "nav.settings": "Settings",
  "status.connecting": "Connecting to data",
  "status.firstRead": "Preparing the first scan…",
  "range.group": "Date range",
  "range.today": "Today",
  "range.7d": "7 days",
  "range.30d": "30 days",
  "range.90d": "90 days",
  "range.all": "All",
  "range.custom": "Custom",
  "range.label.7d": "Last 7 days",
  "range.label.30d": "Last 30 days",
  "range.label.90d": "Last 90 days",
  "range.label.all": "All time",
  "common.refresh": "Refresh",
  "common.loading": "Loading",
  "common.cancel": "Cancel",
  "common.apply": "Apply range",
  "common.cost": "Cost",
  "common.totalTokens": "Total Tokens",
  "common.noData": "No data in the selected range",
  "banner.preview": "Browser preview: the desktop app reads real local ccusage data.",
  "dialog.custom.title": "Custom dates",
  "dialog.custom.description": "Both the start and end dates are included.",
  "dialog.startDate": "Start date",
  "dialog.endDate": "End date",
  "overview.trend": "Trend",
  "overview.dailyUsage": "Daily usage",
  "overview.metric": "Trend metric",
  "overview.chartLabel": "Daily usage trend chart",
  "overview.model": "Model",
  "overview.modelUsage": "Model usage",
  "overview.source": "Source",
  "overview.toolDistribution": "Tool distribution",
  "daily.title": "Daily details",
  "daily.date": "Date",
  "daily.source": "Source",
  "daily.model": "Model",
  "daily.input": "Input",
  "daily.output": "Output",
  "daily.cacheRead": "Cache read",
  "daily.empty": "No daily records in the selected range",
  "daily.shareHelp": "Share of this day's Tokens in the selected date range",
  "sessions.title": "Session share",
  "sessions.search": "Search sessions",
  "sessions.searchPlaceholder": "Search title, project, ID, or model",
  "sessions.sort": "Sort sessions",
  "sessions.sort.tokens": "By Tokens",
  "sessions.sort.cost": "By cost",
  "sessions.sort.latest": "By recent activity",
  "sessions.loadMore": "Show more",
  "sessions.empty": "No matching sessions",
  "settings.cache.title": "Local cache",
  "settings.cache.description": "Results stay in the app cache; repeated views within 5 minutes do not rescan usage files.",
  "settings.currentStatus": "Current status",
  "settings.generatedAt": "Generated at",
  "settings.duration": "Response time",
  "settings.clearCache": "Clear cache",
  "settings.privacy.title": "Fully local",
  "settings.privacy.description": "The bundled ccusage reads data offline. No local server starts and no session or cost data is uploaded.",
  "settings.pricingMode": "Pricing mode",
  "settings.offlineSnapshot": "Offline snapshot",
  "settings.runtime": "Desktop runtime",
  "settings.license": "License",
  "settings.language": "Interface language",
  "settings.language.system": "System default",
  "settings.language.zh": "简体中文",
  "settings.language.en": "English",
  "settings.sources.title": "Detected data sources",
  "view.overview.eyebrow": "USAGE PULSE",
  "view.overview.title": "Usage overview",
  "view.overview.subtitle": "Tokens and cost across local AI coding tools",
  "view.daily.eyebrow": "DAILY LEDGER",
  "view.daily.title": "Daily details",
  "view.daily.subtitle": "Track daily usage, cache utilization, and model changes",
  "view.sessions.eyebrow": "SESSION SHARE",
  "view.sessions.title": "Session analysis",
  "view.sessions.subtitle": "Find the largest sessions and inspect their Token mix",
  "view.settings.eyebrow": "LOCAL FIRST",
  "view.settings.title": "Settings",
  "view.settings.subtitle": "Cache, runtime, and local data source status",
  "time.unknown": "Unknown time",
  "kpi.estimatedCost": "Estimated cost",
  "kpi.offlinePrice": "{range} · Offline pricing",
  "kpi.totalTokens": "Total Tokens",
  "kpi.dailyAverage": "Daily avg. {tokens}",
  "kpi.cacheShare": "Cache share",
  "kpi.cacheReads": "{tokens} cache reads",
  "kpi.peakDay": "Peak day",
  "kpi.noActivity": "No activity",
  "distribution.empty": "No distribution data",
  "chart.summary": "Total {total} · Peak {date}",
  "daily.activeDays": "Active days: {count}",
  "sessions.count": "Sessions",
  "sessions.activeWithin": "Active in {range}",
  "sessions.largest": "Largest session share",
  "sessions.none": "No sessions",
  "sessions.topFive": "Top 5 concentration",
  "sessions.topFiveMeta": "Top five sessions as a share of all Tokens",
  "sessions.unknownModel": "Unknown model",
  "sessions.allShare": "Share of all sessions",
  "sessions.project": "Project",
  "sessions.cwd": "Working directory",
  "sessions.inputTokens": "Input Tokens",
  "sessions.outputTokens": "Output Tokens",
  "sessions.reasoningTokens": "Reasoning Tokens",
  "sessions.models": "Models",
  "sessions.mixHelp": "Input / output / cache read / cache creation · Cache share {share}",
  "sessions.moreRemaining": "Show more ({count} remaining)",
  "cache.stale": "Old cache (refresh failed)",
  "cache.hit": "Cache hit · {seconds}s ago",
  "cache.new": "New cache written",
  "cache.cleared": "Cache cleared",
  "sources.none": "No active sources detected",
  "status.sourcesReady": "Data sources ready: {count}",
  "status.ready": "Data sources ready",
  "status.cacheResponse": "Cache response {duration} ms · {range}",
  "status.scanComplete": "Scan complete {duration} ms · {range}",
  "status.readFailed": "Failed to read data",
  "status.checkFiles": "Check the local usage files",
  "error.date.missing": "Choose custom start and end dates",
  "error.date.invalid": "Choose valid start and end dates",
  "error.date.reversed": "The start date cannot be after the end date",
};

const messages: Record<Locale, Record<MessageKey, string>> = { "zh-CN": zh, en };
const storageKey = "ccusage-language";

export function resolveLocale(language: string): Locale {
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function readPreference(): LanguagePreference {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === "system" || value === "zh-CN" || value === "en") return value;
  } catch {
    // Storage can be unavailable in hardened WebViews.
  }
  return "system";
}

function systemLocale(): Locale {
  return resolveLocale(typeof navigator === "undefined" ? "zh-CN" : navigator.language);
}

let preference = readPreference();
let locale = preference === "system" ? systemLocale() : preference;

export function getLocale(): Locale {
  return locale;
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function setLanguagePreference(value: LanguagePreference): void {
  preference = value;
  locale = value === "system" ? systemLocale() : value;
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Keep the in-memory selection if persistence is unavailable.
  }
}

export function translate(
  language: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return messages[language][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

export function t(key: MessageKey, values?: Record<string, string | number>): string {
  return translate(locale, key, values);
}

export function translateDocument(root?: ParentNode): void {
  const target = root ?? document;
  document.documentElement.lang = locale;
  target.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n as MessageKey);
  });
  target.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder as MessageKey));
  });
  target.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel as MessageKey));
  });
}
