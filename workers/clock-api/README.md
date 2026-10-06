# Clock API Worker

A public test API that reports its deployment identity and the current UTC time. This project demonstrates separate dev and prod implementations within one npm workspace.

## Source and target mapping

- `clock.dev.js` → Wrangler `dev` → Cloudflare Worker `cloudflare-workers-clock-dev`.
- `clock.prod.js` → Wrangler `prod` → Cloudflare Worker `cloudflare-workers-clock-prod`.

The entrypoints and target names are declared together in [wrangler.jsonc](./wrangler.jsonc). Wrangler's `main` property means the source entrypoint; it is independent of the Git branch named `main`. The project has no default top-level entrypoint, so deployment requires an environment selection. Each entrypoint accepts only its matching `ENVIRONMENT` binding.

## Request and response contract

The Worker handles HTTP `fetch` events. There are no scheduled jobs or queue consumers.

- `GET /` and `GET /health`: deployment identity as JSON.
- `GET /time`: the same JSON plus `utc`, the current ISO 8601 UTC timestamp.
- `HEAD` on those routes: response headers with an empty body.
- Unknown routes: HTTP 404.
- Other methods: HTTP 405 with `Allow: GET, HEAD`.
- Missing or wrong `ENVIRONMENT`: HTTP 503 on valid routes.

Successful responses have `Cache-Control: no-store`. The API has no external origin, cache storage, database, authentication requirement or runtime secrets. The response contains only explicit public fields.

Example dev response:

```json
{
  "service": "clock-api",
  "environment": "dev",
  "entrypoint": "clock.dev.js",
  "commit": "<Git commit from the deployment run>",
  "release": "1.0.0",
  "utc": "2026-10-06T00:00:00.000Z"
}
```

The prod response identifies `clock.prod.js`. Both sources currently offer the same functional API; their source identity and binding checks differ. Changes to either source must be tested independently.

## Configuration

- `ENVIRONMENT`: `dev` or `prod`, specified separately in Wrangler configuration.
- `GIT_SHA`: defaults to `local`; GitHub deployment overrides it with the run's commit.
- `CLOUDFLARE_ACCOUNT_ID`: deployment account, supplied by the GitHub repository secret of the same name.
- `CLOUDFLARE_API_TOKEN`: deployment credential, supplied by the selected GitHub environment secret; never returned by the Worker.
- `WORKER_URL`: public target URL displayed in GitHub's deployment record; it does not configure the Cloudflare destination.

GitHub environments are `clock-api-dev` and `clock-api-prod`. Dev supports branch testing. Prod requires `main`, the allowed owner actor and production approval. The existing proof-of-concept credential is account-scoped; distinct GitHub environments alone do not narrow that Cloudflare permission.

## Local development and verification

Run from the repository root with Node.js 24:

```sh
npm ci
npm run check --workspace workers/clock-api
npm run dev --workspace workers/clock-api
```

For the prod source locally:

```sh
cd workers/clock-api
npx --no-install wrangler dev --env prod
```

`check` dry-runs dev and prod packaging without publishing. This minimal POC does not include unit tests or automated endpoint verification; inspect `/health` and `/time` manually after deployment.

## Deployment and verification

1. Open GitHub **Actions → Deploy Worker → Run workflow**.
2. Select the desired branch for dev; choose `main` for prod.
3. Select Worker `clock-api`, then `dev` or `prod`.
4. Start the run and approve the prod environment when prompted.
5. Confirm build validation and deployment pass.
6. Check `/health`: `entrypoint` must be `clock.dev.js` for dev or `clock.prod.js` for prod, and `commit` must equal the run's SHA.

Public test endpoints:

- Dev: https://cloudflare-workers-clock-dev.n-liu.workers.dev/health
- Prod: https://cloudflare-workers-clock-prod.n-liu.workers.dev/health

Use `/time` to verify the clock response as well. Deploying one target should leave the other target's commit and entrypoint unchanged.

## Troubleshooting and rollback

- HTTP 503: check that the selected source matches the `ENVIRONMENT` binding.
- Missing entrypoint during deployment: supply an explicit Wrangler environment.
- Authentication failure: check the selected GitHub environment's token, expiry, scope and account ID.
- Wrong response identity: check the selected source, destination URL and deployed commit.
- Rollback: an authorized Cloudflare operator can open the target Worker's **Deployments** and restore a known-good version. Verify its identity afterward. A dashboard rollback is a separate operation from the GitHub approval workflow.

## References and ownership

- Owner: `sdzfg347` (proof-of-concept repository owner).
- ClickUp: no task link has been supplied for this test Worker. Add the actual task ID/URL if the demo is associated with a task.
- [Deployment workflow](../../.github/workflows/deploy.yml).
- [CI workflow](../../.github/workflows/build.yml).
- [Cloudflare Wrangler environment configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#inheritable-keys).
