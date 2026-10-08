function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export default {
  fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD" });
    }
    const path = new URL(request.url).pathname;
    if (!["/", "/health"].includes(path)) {
      return json({ error: "Not found" }, 404);
    }
    if (env.ENVIRONMENT !== "prod") {
      return json({ error: "The prod entrypoint requires ENVIRONMENT=prod" }, 503);
    }
    const response = json({
      status: "ok",
      service: "health-api",
      environment: env.ENVIRONMENT,
      entrypoint: "health.prod.js",
      commit: env.GIT_SHA ?? "local",
      release: "1.0.0",
    });
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  },
};
