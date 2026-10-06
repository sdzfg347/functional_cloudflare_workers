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

All Worker projects share two GitHub environments: `dev` and `prod`. The deploy job selects the environment directly from the manual form:

```yaml
environment:
  name: ${{ inputs.environment }}
  url: ${{ vars[needs.validate.outputs.worker_url_variable] }}
```

Each environment has its own secret named `CLOUDFLARE_DEPLOYMENT_TOKEN`. The dev value comes from Cloudflare's `dev_workers_deployment_token`; the prod value comes from `prod_workers_deployment_token`. These are different token values. Each token grants Individual Workers Editor on an explicit list of matching targets, initially just `cloudflare-workers-clock-dev` or `cloudflare-workers-clock-prod`. The name does not grant permissions or automatically include future Workers.

Both tokens also have **Workers → Metadata Read-only at account scope**. This permits Wrangler to read the account's `workers.dev` subdomain. The tested Wrangler 4.134.0 uploaded successfully with individual Editor alone, then failed that account-level read; adding metadata read resolved it. This grants metadata visibility across Workers, including prod, while script-content and edit access remain limited to the selected target list. It does not grant account-wide Editor or Workers Scripts Read.

The current replacement tokens expire at **2026-10-18 23:59 UTC** (19 October, 10:59 AEDT). Rotate each environment's secret before that deadline.

The deployment step maps the renamed GitHub secret to Wrangler's required authentication variable:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DEPLOYMENT_TOKEN }}
```

`CLOUDFLARE_API_TOKEN` remains the runner variable because Wrangler reads that exact name. It is not a Worker runtime binding. Neither deployment credential is exposed in the HTTP response. GitHub hides saved secret values; seeing only their names is expected.

The shared account ID remains a **repository secret**, `CLOUDFLARE_ACCOUNT_ID`. Worker URLs remain non-sensitive **per-worker variables inside each environment**. For `clock-api`, configure `WORKER_URL_CLOCK_API` in both `dev` and `prod`, with the corresponding clock URL in each. For a future `fixture-cache` project, add `WORKER_URL_FIXTURE_CACHE` in both environments with that project's URLs.

The validation job derives the variable name from the selected folder: replace hyphens with underscores, uppercase it, then prefix `WORKER_URL_`. It exports that key as `worker_url_variable`; the deploy job looks it up through `vars[needs.validate.outputs.worker_url_variable]`. This supplies the correct GitHub deployment link for the selected Worker and environment. The deployment step checks that the URL is configured before publishing. Wrangler's `env.<environment>.name` still selects the actual Cloudflare destination.

Production protection is configured once on `prod` and applies to every deployment job that references it: branch `main` only, required reviewer `sdzfg347`, and administrator bypass disabled. Self-review is allowed for this one-owner demo. Company repositories should use a release team and enable prevention of self-review when a second approver is required.

Before deploying an older feature branch, merge or rebase the latest `main` so its workflow uses the shared environments, renamed deployment secret and per-worker URL lookup. The workflow file comes from the branch selected at dispatch.

Worker targets and runtime variables are defined in each project's `wrangler.jsonc`. The command is `npm run deploy --workspace "workers/$WORKER" -- --env "$DEPLOY_ENVIRONMENT" --var "GIT_SHA:$GITHUB_SHA"`. `DEPLOY_ENVIRONMENT` comes from the form, while GitHub supplies `GITHUB_SHA` for the selected commit. Wrangler overrides the configured `GIT_SHA: local`; that default keeps local development usable outside Actions. Only explicit non-sensitive fields are returned. Deployment concurrency is scoped to the Worker/environment pair.

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

1. Add `workers/<name>` with a README describing its function, endpoints or triggers, configuration, owner, verification and actual ClickUp/reference links when available.
2. Add its package, dev/prod entrypoints and Wrangler target mapping; update the root lock file.
3. Add the folder name to the predefined `worker.options` dropdown in `deploy.yml`. GitHub choice options are static.
4. Create the dev/prod Cloudflare targets through an authorized account operator. Add each target to its matching deployment token's selected Worker list. Preserve the opposite environment's exclusion.
5. Reuse the existing GitHub `dev` and `prod` environments and their approval rules. No new environment or token is required per Worker.
6. Add `WORKER_URL_<UPPERCASE_FOLDER_WITH_UNDERSCORES>` to both GitHub environments, with each target's base URL. For example, `fixture-cache` uses `WORKER_URL_FIXTURE_CACHE`. The workflow selects it automatically; no URL mapping edit is needed.
7. Run packaging checks, deploy dev from a selected branch, then deploy prod from `main` after approval. Verify the actual endpoint and commit independently.

A dev branch can execute arbitrary workflow code with the dev credential. Cloudflare resource scope is therefore essential: GitHub approvals and actor checks alone cannot stop a broad dev token from modifying prod through the Cloudflare API. Production credentials remain in the protected `prod` environment.
