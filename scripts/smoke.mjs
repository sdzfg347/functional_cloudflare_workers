import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

const { WORKER_URL, EXPECTED_SERVICE, EXPECTED_ENVIRONMENT, EXPECTED_COMMIT } = process.env;
assert.ok(WORKER_URL && EXPECTED_SERVICE && EXPECTED_ENVIRONMENT && EXPECTED_COMMIT,
  "WORKER_URL, EXPECTED_SERVICE, EXPECTED_ENVIRONMENT and EXPECTED_COMMIT are required");
const healthUrl = new URL("/health", WORKER_URL);
assert.equal(healthUrl.protocol, "https:");

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const response = await fetch(healthUrl, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.service, EXPECTED_SERVICE);
    assert.equal(body.environment, EXPECTED_ENVIRONMENT);
    assert.equal(body.commit, EXPECTED_COMMIT);
    console.log(JSON.stringify({ url: healthUrl.href, ...body }));
    break;
  } catch (error) {
    if (attempt === 12) throw error;
    console.log(`Attempt ${attempt}: waiting for the expected deployment`);
    await setTimeout(5_000);
  }
}
