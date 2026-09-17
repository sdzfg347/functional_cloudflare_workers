import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

for (const environment of ["dev", "prod"]) {
  test(`identifies the clock-api ${environment} deployment`, async () => {
    const response = worker.fetch(new Request("https://example.com/health"), {
      ENVIRONMENT: environment, GIT_SHA: "b".repeat(40), SECRET: "not-public",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      service: "clock-api", environment, commit: "b".repeat(40), release: "1.0.0",
    });
  });
}

test("time endpoint returns the current UTC time without caching", async () => {
  const before = Date.now();
  const response = worker.fetch(new Request("https://example.com/time"), { ENVIRONMENT: "dev" });
  const { utc } = await response.json();
  assert.equal(new Date(utc).toISOString(), utc);
  assert.ok(Date.parse(utc) >= before && Date.parse(utc) <= Date.now());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("rejects missing environment, unknown paths and unsupported methods", () => {
  assert.equal(worker.fetch(new Request("https://example.com/health"), {}).status, 503);
  assert.equal(worker.fetch(new Request("https://example.com/missing"), {}).status, 404);
  const response = worker.fetch(new Request("https://example.com/time", { method: "POST" }), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});

test("HEAD produces no body", async () => {
  const response = worker.fetch(new Request("https://example.com/time", { method: "HEAD" }), { ENVIRONMENT: "prod" });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
});
