import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocale, translate } from "./i18n.ts";

test("i18n resolves supported locales and interpolates both languages", () => {
  assert.equal(resolveLocale("zh-Hans-CN"), "zh-CN");
  assert.equal(resolveLocale("en-AU"), "en");
  assert.equal(translate("zh-CN", "daily.activeDays", { count: 3 }), "3 个活跃日");
  assert.equal(translate("en", "sessions.moreRemaining", { count: 12 }), "Show more (12 remaining)");
});
