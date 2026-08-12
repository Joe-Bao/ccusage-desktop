import { invoke } from "@tauri-apps/api/core";
import {
  aggregateAgents,
  aggregateModels,
  cacheShare,
  parseUsageResponse,
  rangeDates,
  rangeLabel,
  sessionLabel,
  sessionsWithShare,
  topFiveConcentration,
  type NamedTotal,
  type RangeKey,
  type SessionUsage,
  type TrendMetric,
  type UsageResponse,
  type ViewKey,
} from "./data";
import { demoResponse } from "./demo";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const IS_TAURI = "__TAURI_INTERNALS__" in window;
const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_COPY: Record<ViewKey, [string, string, string]> = {
  overview: ["USAGE PULSE", "用量总览", "本机所有 AI 编码工具的 Token 与费用"],
  daily: ["DAILY LEDGER", "每日明细", "观察每日消耗、缓存利用与模型变化"],
  sessions: ["SESSION SHARE", "会话分析", "定位占用最高的会话并展开 Token 构成"],
  settings: ["LOCAL FIRST", "设置", "缓存、运行时与本地数据源状态"],
};

const state: {
  range: RangeKey;
  view: ViewKey;
  metric: TrendMetric;
  response: UsageResponse | null;
  sessionQuery: string;
  sessionSort: "tokens" | "cost" | "latest";
  visibleSessions: number;
} = {
  range: "7d",
  view: "overview",
  metric: "tokens",
  response: null,
  sessionQuery: "",
  sessionSort: "tokens",
  visibleSessions: 100,
};

const compactNumber = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const exactNumber = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function byId<T extends Element = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as unknown as T;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function svgNode<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function formatTokens(value: number): string {
  return compactNumber.format(Number.isFinite(value) ? value : 0);
}

function formatExact(value: number): string {
  return exactNumber.format(Number.isFinite(value) ? value : 0);
}

function formatCost(value: number): string {
  return usd.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return percent.format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]} 月 ${match[3]} 日` : value;
}

function formatDateTime(value?: string): string {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderKpis(): void {
  const container = byId("kpi-grid");
  container.replaceChildren();
  const document = state.response?.data;
  if (!document) return;
  const totals = document.totals;
  const activeDays = Math.max(document.daily.length, 1);
  const peak = [...document.daily].sort((a, b) => b.totalTokens - a.totalTokens)[0];
  const cards = [
    {
      label: "预估费用",
      value: formatCost(totals.totalCost),
      meta: `${rangeLabel(state.range)} · 离线价格`,
      icon: "$",
    },
    {
      label: "总 Tokens",
      value: formatTokens(totals.totalTokens),
      meta: `日均 ${formatTokens(totals.totalTokens / activeDays)}`,
      icon: "T",
    },
    {
      label: "缓存占比",
      value: formatPercent(cacheShare(totals)),
      meta: `${formatTokens(totals.cacheReadTokens)} 次缓存读取`,
      icon: "C",
    },
    {
      label: "峰值日",
      value: peak ? formatTokens(peak.totalTokens) : "—",
      meta: peak ? formatDate(peak.period) : "暂无活跃记录",
      icon: "↑",
    },
  ];

  for (const card of cards) {
    const article = node("article", "kpi-card");
    const label = node("div", "kpi-label", card.label);
    label.append(node("span", "kpi-icon", card.icon));
    article.append(label, node("strong", "kpi-value", card.value), node("small", "kpi-meta", card.meta));
    container.append(article);
  }
}

function renderDistribution(containerId: string, items: NamedTotal[]): void {
  const container = byId(containerId);
  container.replaceChildren();
  if (items.length === 0) {
    container.append(node("div", "empty-state", "暂无分布数据"));
    return;
  }

  for (const item of items.slice(0, 5)) {
    const row = node("div", "distribution-item");
    const name = node("span", "distribution-name", item.name);
    name.title = item.name;
    const track = node("span", "distribution-track");
    const fill = node("i", "distribution-fill");
    fill.style.width = `${Math.max(item.share * 100, 0.5)}%`;
    track.append(fill);
    row.append(name, track, node("span", "distribution-value", formatPercent(item.share)));
    container.append(row);
  }
}

function renderTrend(): void {
  const chart = byId<SVGSVGElement>("trend-chart");
  const empty = byId("trend-empty");
  const rows = state.response?.data.daily ?? [];
  chart.replaceChildren();
  chart.toggleAttribute("hidden", rows.length === 0);
  empty.hidden = rows.length > 0;
  if (rows.length === 0) return;

  const width = 800;
  const height = 245;
  const margin = { top: 18, right: 18, bottom: 31, left: 54 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = rows.map((row) => (state.metric === "tokens" ? row.totalTokens : row.totalCost));
  const maximum = Math.max(...values, 1);
  const x = (index: number) =>
    margin.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const y = (value: number) => margin.top + plotHeight - (value / maximum) * plotHeight;

  const definitions = svgNode("defs");
  const gradient = svgNode("linearGradient", { id: "area-fill", x1: "0", x2: "0", y1: "0", y2: "1" });
  gradient.append(
    svgNode("stop", { offset: "0%", "stop-color": "#5eead4", "stop-opacity": "0.24" }),
    svgNode("stop", { offset: "100%", "stop-color": "#5eead4", "stop-opacity": "0" }),
  );
  definitions.append(gradient);
  chart.append(definitions);

  for (let index = 0; index <= 4; index += 1) {
    const value = maximum * (1 - index / 4);
    const lineY = margin.top + (plotHeight * index) / 4;
    chart.append(svgNode("line", {
      class: "chart-grid",
      x1: String(margin.left),
      x2: String(width - margin.right),
      y1: String(lineY),
      y2: String(lineY),
    }));
    const label = svgNode("text", {
      class: "chart-axis-label",
      x: String(margin.left - 9),
      y: String(lineY + 3),
      "text-anchor": "end",
    });
    label.textContent = state.metric === "tokens" ? formatTokens(value) : `$${value.toFixed(value < 10 ? 1 : 0)}`;
    chart.append(label);
  }

  const points = values.map((value, index) => [x(index), y(value)] as const);
  const path = points.map(([pointX, pointY], index) => `${index === 0 ? "M" : "L"}${pointX},${pointY}`).join(" ");
  const baseY = margin.top + plotHeight;
  chart.append(
    svgNode("path", {
      class: "chart-area",
      d: `${path} L${points.at(-1)?.[0]},${baseY} L${points[0][0]},${baseY} Z`,
    }),
    svgNode("path", { class: "chart-line", d: path }),
  );

  const labelStep = Math.max(1, Math.ceil(rows.length / 6));
  rows.forEach((row, index) => {
    if (index % labelStep === 0 || index === rows.length - 1) {
      const label = svgNode("text", {
        class: "chart-axis-label",
        x: String(x(index)),
        y: String(height - 7),
        "text-anchor": "middle",
      });
      label.textContent = row.period.slice(5).replace("-", "/");
      chart.append(label);
    }
    const circle = svgNode("circle", {
      class: "chart-point",
      cx: String(x(index)),
      cy: String(y(values[index])),
      r: rows.length > 45 ? "1.6" : "2.7",
    });
    const title = svgNode("title");
    title.textContent = `${row.period}: ${state.metric === "tokens" ? formatExact(values[index]) + " Tokens" : formatCost(values[index])}`;
    circle.append(title);
    chart.append(circle);
  });

  const total = values.reduce((sum, value) => sum + value, 0);
  const peakIndex = values.indexOf(Math.max(...values));
  byId("legend-primary").textContent = state.metric === "tokens" ? "总 Tokens" : "预估费用";
  byId("chart-summary").textContent = `合计 ${state.metric === "tokens" ? formatTokens(total) : formatCost(total)} · 峰值 ${formatDate(rows[peakIndex].period)}`;
}

function renderOverview(): void {
  const document = state.response?.data;
  if (!document) return;
  renderKpis();
  renderTrend();
  renderDistribution("model-list", aggregateModels(document.daily));
  renderDistribution("agent-list", aggregateAgents(document));
}

function appendCell(row: HTMLTableRowElement, content: string, primary = false): void {
  const cell = node("td");
  const text = node("span", primary ? "table-primary" : undefined, content);
  cell.append(text);
  row.append(cell);
}

function renderDaily(): void {
  const rows = state.response?.data.daily ?? [];
  const body = byId<HTMLTableSectionElement>("daily-body");
  const empty = byId("daily-empty");
  body.replaceChildren();
  empty.hidden = rows.length > 0;
  byId("daily-count").textContent = `${rows.length} 个活跃日`;
  const rangeTotal = Math.max(state.response?.data.totals.totalTokens ?? 0, 1);

  for (const usage of [...rows].reverse()) {
    const row = node("tr");
    const dateCell = node("td");
    dateCell.append(
      node("span", "table-primary", formatDate(usage.period)),
      node("small", "table-secondary", usage.period),
    );
    row.append(dateCell);

    const agentCell = node("td");
    const agentNames = usage.agents?.map((agent) => agent.agent) ?? usage.metadata?.agents ?? [usage.agent];
    const badge = node("span", "agent-badge", agentNames.join(" + "));
    badge.dataset.agent = agentNames[0] ?? "all";
    agentCell.append(badge);
    row.append(agentCell);

    const modelCell = node("td");
    const models = usage.modelsUsed.join(", ") || "—";
    const modelText = node("span", "table-primary", models);
    modelText.title = models;
    modelCell.append(modelText);
    row.append(modelCell);

    appendCell(row, formatTokens(usage.inputTokens));
    appendCell(row, formatTokens(usage.outputTokens));
    appendCell(row, formatTokens(usage.cacheReadTokens));
    const totalCell = node("td");
    totalCell.append(
      node("span", "table-primary", formatTokens(usage.totalTokens)),
      node("small", "table-secondary", `占所选范围 ${formatPercent(usage.totalTokens / rangeTotal)}`),
    );
    row.append(totalCell);
    appendCell(row, formatCost(usage.totalCost), true);
    body.append(row);
  }
}

function sessionPool(): SessionUsage[] {
  const sessions = sessionsWithShare(state.response?.data.session ?? []);
  const query = state.sessionQuery.trim().toLocaleLowerCase();
  const filtered = query
    ? sessions.filter((session) =>
        [session.period, session.agent, ...session.modelsUsed]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
      )
    : sessions;

  return filtered.sort((left, right) => {
    if (state.sessionSort === "cost") return right.totalCost - left.totalCost;
    if (state.sessionSort === "latest") {
      return Date.parse(right.metadata?.lastActivity ?? "") - Date.parse(left.metadata?.lastActivity ?? "");
    }
    return right.totalTokens - left.totalTokens;
  });
}

function renderSessionStats(sessions: SessionUsage[]): void {
  const container = byId("session-stats");
  container.replaceChildren();
  const sorted = [...sessions].sort((left, right) => right.totalTokens - left.totalTokens);
  const cards = [
    ["会话数量", formatExact(sessions.length), `${rangeLabel(state.range)}内有活动`],
    ["最大单会话占用", sorted[0] ? formatPercent(sorted[0].share) : "—", sorted[0] ? sessionLabel(sorted[0].period) : "暂无会话"],
    ["Top 5 集中度", formatPercent(topFiveConcentration(sessions)), "前五个会话占全部 Tokens"],
  ];
  for (const [label, value, meta] of cards) {
    const card = node("article", "mini-stat");
    card.append(node("span", "stat-label", label), node("strong", "stat-value", value), node("small", "stat-meta", meta));
    container.append(card);
  }
}

function detailCell(label: string, value: string): HTMLElement {
  const cell = node("div", "detail-cell");
  cell.append(node("small", undefined, label), node("strong", undefined, value));
  return cell;
}

function renderSessions(): void {
  const allSessions = sessionsWithShare(state.response?.data.session ?? []);
  const sessions = sessionPool();
  const list = byId("session-list");
  const empty = byId("session-empty");
  const more = byId<HTMLButtonElement>("load-more");
  list.replaceChildren();
  renderSessionStats(allSessions);
  byId("session-nav-count").textContent = formatExact(allSessions.length);
  empty.hidden = sessions.length > 0;

  const visible = sessions.slice(0, state.visibleSessions);
  visible.forEach((session, index) => {
    const details = node("details", "session-item");
    const summary = node("summary");
    summary.append(node("span", "session-rank", String(index + 1).padStart(2, "0")));

    const main = node("div", "session-main");
    const title = node("strong", "session-title", sessionLabel(session.period));
    title.title = session.period;
    const subtitle = node("div", "session-subtitle");
    const badge = node("span", "agent-badge", session.agent);
    badge.dataset.agent = session.agent;
    subtitle.append(badge, node("span", undefined, session.modelsUsed.join(", ") || "未知模型"));
    main.append(title, subtitle);

    const share = node("div", "share-column");
    const shareLabel = node("div", "share-label");
    shareLabel.append(node("span", undefined, "占全部会话"), node("strong", undefined, formatPercent(session.share)));
    const track = node("div", "share-track");
    const fill = node("i", "share-fill");
    fill.style.width = `${Math.max(session.share * 100, 0.35)}%`;
    track.append(fill);
    share.append(shareLabel, track);

    const tokenNumber = node("div", "session-number", formatTokens(session.totalTokens));
    tokenNumber.append(node("small", undefined, "Tokens"));
    const costNumber = node("div", "session-number", formatCost(session.totalCost));
    costNumber.append(node("small", undefined, formatDateTime(session.metadata?.lastActivity)));
    summary.append(main, share, tokenNumber, costNumber, node("i", "chevron"));

    const detail = node("div", "session-details");
    detail.append(
      detailCell("输入 Tokens", formatExact(session.inputTokens)),
      detailCell("输出 Tokens", formatExact(session.outputTokens)),
      detailCell("缓存读取", formatExact(session.cacheReadTokens)),
      detailCell("推理 Tokens", formatExact(session.metadata?.reasoningOutputTokens ?? 0)),
      detailCell("模型", session.modelsUsed.join(", ") || "—"),
    );
    const mix = node("div", "token-mix");
    const total = Math.max(session.totalTokens, 1);
    for (const value of [
      session.inputTokens,
      session.outputTokens,
      session.cacheReadTokens,
      session.cacheCreationTokens,
    ]) {
      const segment = node("span");
      segment.style.width = `${(value / total) * 100}%`;
      mix.append(segment);
    }
    mix.title = `输入 / 输出 / 缓存读取 / 缓存创建 · 缓存占比 ${formatPercent(session.cacheShare)}`;
    detail.append(mix);
    details.append(summary, detail);
    list.append(details);
  });

  more.hidden = visible.length >= sessions.length;
  more.textContent = `显示更多（剩余 ${formatExact(sessions.length - visible.length)}）`;
}

function renderSettings(): void {
  const response = state.response;
  if (!response) return;
  byId("cache-state").textContent = response.stale
    ? "旧缓存（刷新失败）"
    : response.cached
      ? `缓存命中 · ${response.cacheAgeSeconds} 秒前`
      : "已写入新缓存";
  byId("cache-time").textContent = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(response.generatedAt * 1000));
  byId("cache-duration").textContent = `${formatExact(response.durationMs)} ms`;
  byId("ccusage-version").textContent = `v${response.ccusageVersion}`;

  const chips = byId("source-chips");
  chips.replaceChildren();
  const sources = aggregateAgents(response.data);
  if (sources.length === 0) {
    chips.append(node("span", "source-chip", "暂未检测到活跃来源"));
  } else {
    for (const source of sources) {
      const chip = node("span", "source-chip", `${source.name} · ${formatPercent(source.share)}`);
      chip.dataset.agent = source.name;
      chips.append(chip);
    }
  }
}

function renderAll(): void {
  renderOverview();
  renderDaily();
  renderSessions();
  renderSettings();
}

function setView(view: ViewKey): void {
  state.view = view;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll<HTMLElement>(".view").forEach((section) => {
    section.hidden = section.id !== `view-${view}`;
    section.classList.toggle("is-active", !section.hidden);
  });
  const [eyebrow, title, subtitle] = VIEW_COPY[view];
  byId("view-eyebrow").textContent = eyebrow;
  byId("view-title").textContent = title;
  byId("view-subtitle").textContent = subtitle;
  byId("view-title").focus?.();
}

function setLoading(loading: boolean): void {
  byId("load-line").classList.toggle("is-loading", loading);
  const refresh = byId<HTMLButtonElement>("refresh-button");
  refresh.disabled = loading;
  refresh.classList.toggle("is-loading", loading);
  refresh.querySelector("span")!.textContent = loading ? "读取中" : "刷新";
  document.querySelector(".workspace")?.setAttribute("aria-busy", String(loading));
}

function showBanner(message?: string | null, error = false): void {
  const banner = byId("banner");
  banner.hidden = !message;
  banner.classList.toggle("is-error", error);
  banner.textContent = message ?? "";
}

function updateStatus(): void {
  const response = state.response;
  if (!response) return;
  const sources = aggregateAgents(response.data);
  const dot = byId("status-dot");
  dot.className = `status-dot ${response.stale ? "is-error" : "is-ready"}`;
  byId("source-status").textContent = sources.length > 0 ? `${sources.length} 个数据源已就绪` : "数据源已就绪";
  byId("sync-status").textContent = response.cached
    ? `缓存响应 ${response.durationMs} ms · ${rangeLabel(state.range)}`
    : `扫描完成 ${response.durationMs} ms · ${rangeLabel(state.range)}`;
}

async function loadUsage(refresh: boolean): Promise<void> {
  setLoading(true);
  showBanner();
  try {
    const raw = IS_TAURI
      ? await invoke<UsageResponse>("load_usage", {
          request: { ...rangeDates(state.range), refresh },
        })
      : demoResponse(state.range);
    state.response = parseUsageResponse(raw);
    renderAll();
    updateStatus();
    showBanner(state.response.warning, state.response.stale);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    byId("status-dot").className = "status-dot is-error";
    byId("source-status").textContent = "数据读取失败";
    byId("sync-status").textContent = "请检查本机 usage 文件";
    showBanner(message, true);
  } finally {
    setLoading(false);
  }
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view as ViewKey));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      const range = button.dataset.range as RangeKey;
      if (range === state.range) return;
      state.range = range;
      state.visibleSessions = 100;
      document.querySelectorAll("[data-range]").forEach((item) =>
        item.classList.toggle("is-active", (item as HTMLElement).dataset.range === range),
      );
      void loadUsage(false);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric as TrendMetric;
      document.querySelectorAll("[data-metric]").forEach((item) =>
        item.classList.toggle("is-active", (item as HTMLElement).dataset.metric === state.metric),
      );
      renderTrend();
    });
  });
  byId("refresh-button").addEventListener("click", () => void loadUsage(true));
  byId<HTMLInputElement>("session-search").addEventListener("input", (event) => {
    state.sessionQuery = (event.currentTarget as HTMLInputElement).value;
    state.visibleSessions = 100;
    renderSessions();
  });
  byId<HTMLSelectElement>("session-sort").addEventListener("change", (event) => {
    state.sessionSort = (event.currentTarget as HTMLSelectElement).value as typeof state.sessionSort;
    renderSessions();
  });
  byId("load-more").addEventListener("click", () => {
    state.visibleSessions += 100;
    renderSessions();
  });
  byId("clear-cache").addEventListener("click", async () => {
    const button = byId<HTMLButtonElement>("clear-cache");
    button.disabled = true;
    try {
      if (IS_TAURI) await invoke("clear_cache");
      button.textContent = "缓存已清除";
      await loadUsage(true);
    } catch (error) {
      showBanner(error instanceof Error ? error.message : String(error), true);
    } finally {
      button.disabled = false;
      button.textContent = "清除缓存";
    }
  });
}

bindEvents();
setView("overview");
void loadUsage(false);
