import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

for (const environment of ["dev", "prod"]) {
  test(`reports the configured ${environment} environment and commit`, async () => {
    const response = worker.fetch(new Request("https://worker.example/health"), {
      ENVIRONMENT: environment,
      GIT_SHA: "a".repeat(40),
      SECRET_NOT_FOR_PUBLIC_RESPONSE: "must-not-leak",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      service: "cloudflare-workers-poc",
      environment,
      commit: "a".repeat(40),
      release: "1.0.0",
    });
  });
}

test("rejects an unconfigured environment", () => {
  assert.equal(worker.fetch(new Request("https://worker.example/health"), {}).status, 503);
});

test("rejects unsupported methods", () => {
  const response = worker.fetch(new Request("https://worker.example/", { method: "POST" }), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});

test("returns 404 for unrelated paths", () => {
  assert.equal(worker.fetch(new Request("https://worker.example/missing"), {}).status, 404);
});

test("HEAD preserves headers without returning a body", async () => {
  const response = worker.fetch(new Request("https://worker.example/health", { method: "HEAD" }), {
    ENVIRONMENT: "dev",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "");
});
