# Manual Cloudflare Workers deployment

A proof of concept for manually deploying the same code from `main` to two Cloudflare Workers.

- Dev: https://cloudflare-workers-poc-dev.n-liu.workers.dev/health
- Prod test target: https://cloudflare-workers-poc-prod.n-liu.workers.dev/health

Both are test Workers. Each response contains its environment and deployed Git commit.

## Deploy

1. Open **Actions → Manual Deploy Worker → Run workflow**.
2. Select the **main** branch.
3. Select **dev** or **prod** and run the workflow.
4. Check the run's verification step and the selected Worker's `/health` URL.

Pushes and pull requests run validation only. Deployments require a manual run. Runs from other branches skip the deployment job. Each GitHub environment is also restricted to the `main` branch.

The commit captured when the run starts is checked out explicitly and reported by the Worker. A new manual run deploys the current `main` commit; this is not an immutable-artifact promotion system.

## Configuration

GitHub environments `dev` and `prod` each contain a `CLOUDFLARE_API_TOKEN` secret and a `WORKER_URL` variable. The account ID is stored as the repository variable `CLOUDFLARE_ACCOUNT_ID`.

Worker targets and runtime variables are defined explicitly in `wrangler.jsonc`. The deployment step overrides `GIT_SHA` with the workflow's commit SHA. Only explicit non-sensitive fields are returned by the Worker.

## Local validation

Use Node.js 24:

```sh
npm ci
npm test
npm run check
npm run dev
```

`npm run check` bundles both targets using Wrangler's dry-run mode without deploying.

The deployed endpoints are public and contain no business logic, credentials or company data. Cloudflare's native Git Builds integration is unnecessary for this GitHub Actions flow.
