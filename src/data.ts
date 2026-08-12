export type RangeKey = "7d" | "30d" | "90d" | "all";
export type ViewKey = "overview" | "daily" | "sessions" | "settings";
export type TrendMetric = "tokens" | "cost";

export interface TokenNumbers {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

export interface ModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface AgentBreakdown extends TokenNumbers {
  agent: string;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
}

export interface UsageRow extends TokenNumbers {
  agent: string;
  period: string;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
  agents?: AgentBreakdown[];
  metadata?: {
    agents?: string[];
    lastActivity?: string;
    reasoningOutputTokens?: number;
  };
}

export interface UsageDocument {
  daily: UsageRow[];
  session: UsageRow[];
  totals: TokenNumbers;
}

export interface UsageResponse {
  data: UsageDocument;
  cached: boolean;
  stale: boolean;
  generatedAt: number;
  cacheAgeSeconds: number;
  durationMs: number;
  ccusageVersion: string;
  warning?: string | null;
}

export interface NamedTotal {
  name: string;
  tokens: number;
  cost: number;
  share: number;
}

export interface SessionUsage extends UsageRow {
  share: number;
  cacheShare: number;
}

const ZERO_TOTALS: TokenNumbers = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  totalCost: 0,
};

function localDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function rangeDates(
  range: RangeKey,
  now = new Date(),
): { since?: string; until?: string } {
  if (range === "all") return {};
  const days = Number.parseInt(range, 10);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { since: localDate(start), until: localDate(end) };
}

export function rangeLabel(range: RangeKey): string {
  return { "7d": "最近 7 天", "30d": "最近 30 天", "90d": "最近 90 天", all: "全部时间" }[
    range
  ];
}

export function parseUsageResponse(input: unknown): UsageResponse {
  if (typeof input !== "object" || input === null) {
    throw new Error("桌面后端返回了无效响应");
  }
  const response = input as Partial<UsageResponse> & { data?: unknown };
  if (typeof response.data !== "object" || response.data === null) {
    throw new Error("ccusage 响应缺少数据");
  }
  const raw = response.data as Partial<UsageDocument>;
  return {
    data: {
      daily: Array.isArray(raw.daily) ? raw.daily : [],
      session: Array.isArray(raw.session) ? raw.session : [],
      totals: raw.totals ?? ZERO_TOTALS,
    },
    cached: Boolean(response.cached),
    stale: Boolean(response.stale),
    generatedAt: Number(response.generatedAt) || 0,
    cacheAgeSeconds: Number(response.cacheAgeSeconds) || 0,
    durationMs: Number(response.durationMs) || 0,
    ccusageVersion: String(response.ccusageVersion ?? "unknown"),
    warning: response.warning,
  };
}

export function cacheShare(tokens: TokenNumbers): number {
  return tokens.totalTokens > 0 ? tokens.cacheReadTokens / tokens.totalTokens : 0;
}

export function sessionsWithShare(rows: UsageRow[]): SessionUsage[] {
  const total = rows.reduce((sum, row) => sum + row.totalTokens, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.totalTokens / total : 0,
    cacheShare: cacheShare(row),
  }));
}

export function aggregateModels(rows: UsageRow[]): NamedTotal[] {
  const models = new Map<string, { tokens: number; cost: number }>();
  for (const row of rows) {
    for (const model of row.modelBreakdowns ?? []) {
      const current = models.get(model.modelName) ?? { tokens: 0, cost: 0 };
      current.tokens +=
        model.inputTokens +
        model.outputTokens +
        model.cacheCreationTokens +
        model.cacheReadTokens;
      current.cost += model.cost;
      models.set(model.modelName, current);
    }
  }
  return namedTotals(models);
}

export function aggregateAgents(document: UsageDocument): NamedTotal[] {
  const agents = new Map<string, { tokens: number; cost: number }>();
  for (const row of document.daily) {
    for (const agent of row.agents ?? []) {
      const current = agents.get(agent.agent) ?? { tokens: 0, cost: 0 };
      current.tokens += agent.totalTokens;
      current.cost += agent.totalCost;
      agents.set(agent.agent, current);
    }
  }

  if (agents.size === 0) {
    for (const row of document.session) {
      const current = agents.get(row.agent) ?? { tokens: 0, cost: 0 };
      current.tokens += row.totalTokens;
      current.cost += row.totalCost;
      agents.set(row.agent, current);
    }
  }
  return namedTotals(agents);
}

function namedTotals(source: Map<string, { tokens: number; cost: number }>): NamedTotal[] {
  const total = [...source.values()].reduce((sum, item) => sum + item.tokens, 0);
  return [...source.entries()]
    .map(([name, value]) => ({
      name,
      ...value,
      share: total > 0 ? value.tokens / total : 0,
    }))
    .sort((left, right) => right.tokens - left.tokens);
}

export function sessionLabel(period: string): string {
  const normalized = period.split(String.fromCharCode(92)).join("/");
  const name = normalized.split("/").at(-1) || period;
  if (name.length <= 56) return name;
  return `${name.slice(0, 24)}…${name.slice(-27)}`;
}

export function topFiveConcentration(sessions: SessionUsage[]): number {
  return [...sessions]
    .sort((left, right) => right.totalTokens - left.totalTokens)
    .slice(0, 5)
    .reduce((sum, session) => sum + session.share, 0);
}
