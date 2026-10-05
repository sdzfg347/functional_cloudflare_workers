import assert from "node:assert/strict";
import test from "node:test";
import devWorker from "../clock.dev.js";
import prodWorker from "../clock.prod.js";

for (const [environment, worker] of [["dev", devWorker], ["prod", prodWorker]]) {
  const bindings = { ENVIRONMENT: environment, GIT_SHA: "b".repeat(40), SECRET: "not-public" };

  test(`${environment}: root and health identify the selected source without exposing secrets`, async () => {
    for (const pathname of ["/", "/health"]) {
      const response = worker.fetch(new Request(`https://example.com${pathname}`), bindings);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), {
        service: "clock-api", environment, entrypoint: `clock.${environment}.js`,
        commit: "b".repeat(40), release: "1.0.0",
      });
    }
  });

  test(`${environment}: rejects bindings for the other environment`, async () => {
    const opposite = environment === "dev" ? "prod" : "dev";
    const response = worker.fetch(new Request("https://example.com/health"), { ENVIRONMENT: opposite });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: `The ${environment} entrypoint requires ENVIRONMENT=${environment}`,
    });
  });

  test(`${environment}: rejects missing environment configuration`, () => {
    assert.equal(worker.fetch(new Request("https://example.com/health"), {}).status, 503);
  });

  test(`${environment}: time endpoint returns current UTC time without caching`, async () => {
    const before = Date.now();
    const response = worker.fetch(new Request("https://example.com/time"), bindings);
    assert.equal(response.status, 200);
    const { utc } = await response.json();
    assert.equal(new Date(utc).toISOString(), utc);
    assert.ok(Date.parse(utc) >= before && Date.parse(utc) <= Date.now());
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  test(`${environment}: returns 404 for unknown paths`, () => {
    assert.equal(worker.fetch(new Request("https://example.com/missing"), bindings).status, 404);
  });

  test(`${environment}: rejects unsupported methods`, () => {
    const response = worker.fetch(new Request("https://example.com/time", { method: "POST" }), bindings);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET, HEAD");
  });

  test(`${environment}: HEAD preserves headers with no response body`, async () => {
    const response = worker.fetch(new Request("https://example.com/time", { method: "HEAD" }), bindings);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(await response.text(), "");
  });
}
