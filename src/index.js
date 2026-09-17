function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export default {
  fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD" });
    }

    const pathname = new URL(request.url).pathname;
    if (pathname !== "/" && pathname !== "/health") {
      return json({ error: "Not found" }, 404);
    }

    if (!["dev", "prod"].includes(env.ENVIRONMENT)) {
      return json({ error: "Environment is not configured" }, 503);
    }

    const response = json({
      service: "cloudflare-workers-poc",
      environment: env.ENVIRONMENT,
      commit: env.GIT_SHA ?? "local",
      release: "1.0.0",
    });
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  },
};
