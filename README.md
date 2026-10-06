# Cloudflare Workers monorepo

A minimal POC demonstrating manual GitHub Actions deployments of a clock Worker, with separate dev and prod source files. Dev can deploy from any selected branch; prod deploys from `main` with approval.

```text
workers/
  clock-api/
    README.md
    clock.dev.js
    clock.prod.js
    package.json
    wrangler.jsonc
.github/workflows/
  build.yml
  deploy.yml
package.json
package-lock.json
```

The root uses npm workspaces and one lock file so additional Worker projects can be added later. The clock project owns its two source files, Wrangler configuration and deployment script. CI and deployment perform packaging checks; endpoint verification is manual.

- [clock-api](workers/clock-api/README.md) reports deployment identity at `/health` and current UTC time at `/time`.
  - Dev: https://cloudflare-workers-clock-dev.n-liu.workers.dev/time
  - Prod: https://cloudflare-workers-clock-prod.n-liu.workers.dev/time

Both destinations are test Workers. Each response contains its project, environment, source entrypoint and deployed Git commit.

## Deploy

1. Open **Actions → Deploy Worker → Run workflow**.
2. Select the branch to test.
3. Select the Worker project: `clock-api`.
4. Select **dev** or **prod** and run the workflow.
5. Confirm the deployment step succeeds, then open the selected Worker's `/health` or `/time` URL to verify it manually.

Only the selected Worker/environment is deployed. Pushes and pull requests run validation only. `theideasaler` may deploy dev from any branch; prod requires `main` and owner approval. `sdzfg347` may deploy dev from any branch and prod from `main`. Main requires reviewed pull requests so a collaborator cannot replace this access rule by pushing a workflow edit directly.

The commit captured when the run starts is checked out explicitly and reported by the Worker. A dev run deploys the selected branch's commit; a prod run deploys a selected `main` commit. This is not an immutable-artifact promotion system.

## Configuration

GitHub environments `clock-api-dev` and `clock-api-prod` contain a `CLOUDFLARE_API_TOKEN` secret and a `WORKER_URL` variable. `WORKER_URL` is displayed as the deployment link in GitHub; it does not select the Cloudflare target. The shared account ID is stored as the repository secret `CLOUDFLARE_ACCOUNT_ID`, and the deployment step reads it through `secrets.CLOUDFLARE_ACCOUNT_ID`.

Before deploying an older feature branch, merge or rebase the latest `main` so that branch's `deploy.yml` also reads the account ID from secrets.

Worker targets and runtime variables are defined in each project's `wrangler.jsonc`. The deployment step overrides `GIT_SHA` with the workflow's commit SHA. Only explicit non-sensitive fields are returned. Deployment concurrency is scoped to the Worker/environment pair.

## Separate dev and prod source files

The `clock-api` project keeps both entrypoints in the same folder:

```text
workers/clock-api/clock.dev.js
workers/clock-api/clock.prod.js
```

Its Wrangler configuration pairs each entrypoint with a destination. Here `main` means the JavaScript source entrypoint and `name` means the Cloudflare Worker to update. The Git branch named `main` is selected separately by the workflow:

```json
"env": {
  "dev": {
    "name": "cloudflare-workers-clock-dev",
    "main": "clock.dev.js",
    "vars": { "ENVIRONMENT": "dev", "GIT_SHA": "local" }
  },
  "prod": {
    "name": "cloudflare-workers-clock-prod",
    "main": "clock.prod.js",
    "vars": { "ENVIRONMENT": "prod", "GIT_SHA": "local" }
  }
}
```

Selecting `clock-api` and `dev` in the manual workflow bundles `clock.dev.js` and updates `cloudflare-workers-clock-dev`. Selecting `prod` bundles `clock.prod.js` and updates `cloudflare-workers-clock-prod`. The command already passes `--env`, so source selection is handled by Wrangler without separate deployment workflows.

There is no default top-level `main` for `clock-api`. An unqualified `wrangler deploy` fails with a missing-entrypoint error; pass `--env dev` or `--env prod` through the existing deployment command.

Both files currently provide the same API contract, with deliberately distinct identity fields:

```json
{
  "service": "clock-api",
  "environment": "prod",
  "entrypoint": "clock.prod.js",
  "commit": "<deployed Git commit>",
  "release": "1.0.0"
}
```

The dev response reports `clock.dev.js`. Each entrypoint returns HTTP 503 if its `ENVIRONMENT` binding belongs to the other environment or is missing. This catches mismatched runtime configuration. Cloudflare token scope and GitHub environment rules provide the access-control boundary; a filename is not a permission restriction.

Dev and prod implementations can evolve independently. A successful dev deployment does not verify the prod source. Old/new versions belong in Git commits or branches while filenames remain stable.

`build.yml` runs `npm ci` and `npm run check`. The manual deployment workflow validates the selected folder, packages both clock environments, and deploys the selected one. This minimal POC has no unit-test folder or automated smoke-check script; use the public endpoints to verify the environment, entrypoint and commit after deployment.

## Local validation

Use Node.js 24:

```sh
npm ci
npm run check
npm run dev --workspace workers/clock-api
```

`npm run check` bundles the clock dev and prod configurations using Wrangler's dry-run mode without deploying.

To check only the clock workspace, use `npm run check --workspace workers/clock-api`.

To run the prod clock source locally:

```sh
cd workers/clock-api
npx --no-install wrangler dev --env prod
```

Run this separately from the dev server or choose a different local port.

The deployed endpoints are public and contain no business logic, credentials or company data. Cloudflare's native Git Builds integration is unnecessary for this GitHub Actions flow.

## Add a Worker

Add `workers/<name>` with its own README, package, source and Wrangler environments; update the lock file; add the folder to the `worker` input options in `.github/workflows/deploy.yml`; and configure its two GitHub environments and corresponding Cloudflare credentials before deploying. The workflow validates the selected folder before accessing its environment secret.
