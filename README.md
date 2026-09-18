# Cloudflare Workers monorepo

Two independent Worker projects, each deployable to dev or prod from `main`.

```text
workers/
  health-api/
    src/index.js
    test/worker.test.js
    package.json
    wrangler.jsonc
  clock-api/
    src/index.js
    test/worker.test.js
    package.json
    wrangler.jsonc
scripts/smoke.mjs
.github/workflows/
  ci.yml
  manual-deploy.yml
package.json
package-lock.json
```

The root uses npm workspaces and one lock file. Each Worker owns its source, tests, Wrangler configuration and deployment script.

- `health-api` reports deployment identity at `/` and `/health`.
  - Dev: https://cloudflare-workers-poc-dev.n-liu.workers.dev/health
  - Prod: https://cloudflare-workers-poc-prod.n-liu.workers.dev/health
- `clock-api` reports deployment identity at `/health` and current UTC time at `/time`.
  - Dev: https://cloudflare-workers-clock-dev.n-liu.workers.dev/time
  - Prod: https://cloudflare-workers-clock-prod.n-liu.workers.dev/time

All four are test Workers. Each response contains its project, environment and deployed Git commit.

## Deploy

1. Open **Actions → Manual Deploy Worker → Run workflow**.
2. Select the **main** branch.
3. Select Worker **health-api** or **clock-api**.
4. Select **dev** or **prod** and run the workflow.
5. Check the run's verification step and the selected Worker's `/health` URL.

Only the selected Worker/environment is deployed. Pushes and pull requests run validation only. Runs from other branches skip the deployment job. `theideasaler` is allowed only for dev deployments; `sdzfg347` is allowed for both dev and prod. Each GitHub environment is also restricted to the `main` branch, and `main` requires reviewed pull requests so a collaborator cannot replace this access rule by pushing a workflow edit directly.

The commit captured when the run starts is checked out explicitly and reported by the Worker. A new manual run deploys the current `main` commit; this is not an immutable-artifact promotion system.

## Configuration

GitHub environments `health-api-dev`, `health-api-prod`, `clock-api-dev` and `clock-api-prod` each contain a `CLOUDFLARE_API_TOKEN` secret for the corresponding Worker and a `WORKER_URL` variable. The shared account ID is stored as the repository variable `CLOUDFLARE_ACCOUNT_ID`.

Worker targets and runtime variables are defined in each project's `wrangler.jsonc`. The deployment step overrides `GIT_SHA` with the workflow's commit SHA. Only explicit non-sensitive fields are returned. Deployment concurrency is scoped to the Worker/environment pair.

## Local validation

Use Node.js 24:

```sh
npm ci
npm test
npm run check
npm run dev --workspace workers/health-api
npm run dev --workspace workers/clock-api
```

Run development servers separately or choose distinct ports. `npm run check` bundles all four configurations using Wrangler's dry-run mode without deploying.

For one project, use `npm test --workspace workers/clock-api` or `npm run check --workspace workers/clock-api`.

The deployed endpoints are public and contain no business logic, credentials or company data. Cloudflare's native Git Builds integration is unnecessary for this GitHub Actions flow.

## Add a Worker

Add `workers/<name>` with its own package, source, tests and Wrangler environments; update the lock file; and add the name to the manual workflow's choices and allowlist. Configure its two GitHub environments and corresponding Cloudflare credentials before deploying.
