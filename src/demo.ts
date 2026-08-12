import type {
  AgentBreakdown,
  DateRange,
  TokenNumbers,
  UsageResponse,
  UsageRow,
} from "./data.ts";

const AGENTS = ["codex", "claude", "opencode"];
const MODELS = ["gpt-5.6-sol", "gpt-5.5", "claude-opus-4-7"];
const PROJECTS = [
  { name: "api", cwd: "D:\\api" },
  { name: "research", cwd: "D:\\research" },
  { name: "ccusage-desktop", cwd: "D:\\api\\ccusage-desktop" },
];
const SESSION_TITLES = [
  "创建 ccusage Windows WebView 项目",
  "优化 API 请求性能",
  "修复单日趋势图显示",
  "增加会话标题与项目",
  "验证本地缓存行为",
];

function dayString(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

function totals(rows: UsageRow[]): TokenNumbers {
  return rows.reduce<TokenNumbers>(
    (sum, row) => ({
      inputTokens: sum.inputTokens + row.inputTokens,
      outputTokens: sum.outputTokens + row.outputTokens,
      cacheCreationTokens: sum.cacheCreationTokens + row.cacheCreationTokens,
      cacheReadTokens: sum.cacheReadTokens + row.cacheReadTokens,
      totalTokens: sum.totalTokens + row.totalTokens,
      totalCost: sum.totalCost + row.totalCost,
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    },
  );
}

function breakdown(agent: string, index: number, multiplier = 1): AgentBreakdown {
  const inputTokens = Math.round((180_000 + ((index * 71_113) % 390_000)) * multiplier);
  const outputTokens = Math.round((28_000 + ((index * 13_771) % 95_000)) * multiplier);
  const cacheReadTokens = Math.round((2_400_000 + ((index * 971_221) % 8_900_000)) * multiplier);
  const cacheCreationTokens = Math.round((index % 3) * 21_000 * multiplier);
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const modelName = MODELS[index % MODELS.length];
  const totalCost = (inputTokens * 0.000002 + outputTokens * 0.00001 + cacheReadTokens * 0.0000002) *
    (modelName.includes("opus") ? 1.4 : 1);
  return {
    agent,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    totalCost,
    modelsUsed: [modelName],
    modelBreakdowns: [
      {
        modelName,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        cost: totalCost,
      },
    ],
  };
}

function makeDaily(days: number, now: Date): UsageRow[] {
  return Array.from({ length: days }, (_, reverseIndex) => {
    const index = days - reverseIndex - 1;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index);
    const agents = [breakdown("codex", index, 1 + (index % 5) * 0.08)];
    if (index % 4 === 0) agents.push(breakdown("claude", index + 8, 0.24));
    if (index % 9 === 0) agents.push(breakdown("opencode", index + 13, 0.12));
    const total = totals(agents as UsageRow[]);
    return {
      agent: "all",
      period: dayString(date),
      ...total,
      modelsUsed: [...new Set(agents.flatMap((agent) => agent.modelsUsed))],
      modelBreakdowns: agents.flatMap((agent) => agent.modelBreakdowns),
      agents,
      metadata: { agents: agents.map((agent) => agent.agent) },
    };
  });
}

function makeSessions(days: number, now: Date): UsageRow[] {
  const count = Math.min(Math.max(days * 2, 18), 96);
  return Array.from({ length: count }, (_, index) => {
    const data = breakdown(AGENTS[index % AGENTS.length], index + 3, 0.08 + (index % 11) * 0.035);
    const activity = new Date(now.getTime() - (index * 7.5 * 60 * 60 * 1000));
    const project = PROJECTS[Math.floor(index / AGENTS.length) % PROJECTS.length];
    return {
      ...data,
      period: `${dayString(activity).replaceAll("-", "/")}/rollout-demo-${String(index + 1).padStart(3, "0")}`,
      metadata: {
        lastActivity: activity.toISOString(),
        reasoningOutputTokens: Math.round(data.outputTokens * (0.08 + (index % 4) * 0.04)),
        ...(data.agent === "codex"
          ? {
              cwd: project.cwd,
              project: project.name,
              title: SESSION_TITLES[index % SESSION_TITLES.length],
            }
          : {}),
      },
    };
  });
}

function compactDate(value: string | undefined, fallback: Date): Date {
  if (!value || value.length !== 8) return fallback;
  return new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6)));
}

export function demoResponse(range: DateRange, now = new Date()): UsageResponse {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = compactDate(range.until, today);
  const fallbackStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 119);
  const start = compactDate(range.since, fallbackStart);
  const days = Math.max(
    1,
    Math.round(
      (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
        86_400_000,
    ) + 1,
  );
  const daily = makeDaily(days, end);
  const session = makeSessions(days, end);
  return {
    data: { daily, session, totals: totals(daily) },
    cached: true,
    stale: false,
    generatedAt: Math.floor(now.getTime() / 1000),
    cacheAgeSeconds: 8,
    durationMs: 3,
    ccusageVersion: "20.0.19",
    warning: "浏览器预览模式：桌面应用会读取本机真实 ccusage 数据。",
  };
}
