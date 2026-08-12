import assert from "node:assert/strict";
import test from "node:test";
import { fetchLatestVersion, isNewerVersion } from "./updates.ts";

test("compares stable semantic versions with optional v prefixes", () => {
  assert.equal(isNewerVersion("0.1.5", "v0.1.6"), true);
  assert.equal(isNewerVersion("0.1.5", "v0.2.0"), true);
  assert.equal(isNewerVersion("0.1.5", "0.1.5"), false);
  assert.equal(isNewerVersion("0.1.5", "v0.1.4"), false);
  assert.equal(isNewerVersion("0.1.5", "latest"), false);
});

test("reads the latest release tag and tolerates a missing release", async () => {
  const available = await fetchLatestVersion(
    async () => new Response(JSON.stringify({ tag_name: "v0.2.0" })),
  );
  const missing = await fetchLatestVersion(async () => new Response(null, { status: 404 }));

  assert.equal(available, "v0.2.0");
  assert.equal(missing, null);
});
