import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateAgents,
  aggregateModels,
  customRangeDates,
  DateRangeError,
  rangeDates,
  rangeLabel,
  sessionLabel,
  sessionTitle,
  sessionsWithShare,
  type UsageDocument,
  type UsageRow,
} from "./data.ts";

const row = (overrides: Partial<UsageRow> = {}): UsageRow => ({
  agent: "codex",
  period: "中文会话 🚀",
  inputTokens: 10,
  outputTokens: 5,
  cacheCreationTokens: 0,
  cacheReadTokens: 85,
  totalTokens: 100,
  totalCost: 1,
  modelsUsed: ["gpt-5.6-sol"],
  modelBreakdowns: [
    {
      modelName: "gpt-5.6-sol",
      inputTokens: 10,
      outputTokens: 5,
      cacheCreationTokens: 0,
      cacheReadTokens: 85,
      cost: 1,
    },
  ],
  ...overrides,
});

test("date ranges are inclusive and use local calendar dates", () => {
  assert.deepEqual(rangeDates("7d", new Date(2026, 7, 13, 23, 59)), {
    since: "20260807",
    until: "20260813",
  });
  assert.deepEqual(rangeDates("today", new Date(2026, 7, 13, 23, 59)), {
    since: "20260813",
    until: "20260813",
  });
  assert.deepEqual(rangeDates("all"), {});
});

test("custom date ranges normalize native date values and reject reversed dates", () => {
  const custom = customRangeDates("2026-08-01", "2026-08-13");
  assert.deepEqual(custom, { since: "20260801", until: "20260813" });
  assert.deepEqual(rangeDates("custom", new Date(), custom), custom);
  assert.equal(rangeLabel("custom", custom), "2026/08/01 – 2026/08/13");
  assert.throws(
    () => customRangeDates("2026-08-14", "2026-08-13"),
    (error) => error instanceof DateRangeError && error.code === "reversed",
  );
});

test("session shares retain UTF-8 labels and sum to one", () => {
  const sessions = sessionsWithShare([row(), row({ period: "second", totalTokens: 300 })]);
  assert.equal(sessions[0].period, "中文会话 🚀");
  assert.equal(sessions[0].share, 0.25);
  assert.equal(sessions[1].share, 0.75);
  assert.equal(sessionLabel("项目/中文会话 🚀"), "中文会话 🚀");
  assert.equal(
    sessionTitle(row({ metadata: { title: "可读标题", project: "api" } })),
    "可读标题",
  );
});

test("model and agent aggregation uses token totals", () => {
  const document: UsageDocument = {
    daily: [
      row({
        agents: [
          {
            agent: "codex",
            inputTokens: 10,
            outputTokens: 5,
            cacheCreationTokens: 0,
            cacheReadTokens: 85,
            totalTokens: 100,
            totalCost: 1,
            modelsUsed: ["gpt-5.6-sol"],
            modelBreakdowns: [],
          },
        ],
      }),
    ],
    session: [],
    totals: row(),
  };
  assert.equal(aggregateModels(document.daily)[0].tokens, 100);
  assert.equal(aggregateAgents(document)[0].share, 1);
});
