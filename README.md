# Cloudflare Workers deployment POC

This proof of concept (POC) uses GitHub Actions to deploy Cloudflare Workers.
The repository contains one Worker project, `clock-api`, with separate dev and prod source files.

Pushes and pull requests start build checks.
An operator starts each deployment manually.
All projects use the same GitHub environments: `dev` and `prod`.

## Choose a guide

- [Personal demo setup](DEMO_SETUP.md): reproduce the complete flow with your own accounts.
- [Company setup](SETUP.md): configure organization access, team approval, and deployment permissions.
- [Clock Worker instructions](workers/clock-api/README.md): inspect the API, develop locally, and verify a deployment.

## Folder structure

```text
.
├── .github/
│   └── workflows/
│       ├── build.yml
│       └── deploy.yml
├── workers/
│   └── clock-api/
│       ├── README.md
│       ├── clock.dev.js
│       ├── clock.prod.js
│       ├── package.json
│       └── wrangler.jsonc
├── .gitignore
├── DEMO_SETUP.md
├── README.md
├── SETUP.md
├── package.json
└── package-lock.json
```

The root `package.json` defines npm workspaces under `workers/*`.
The root lock file fixes dependency versions for installation.
Each Worker folder contains its source files, configuration, commands, and instructions.

The POC has no test, scripts, or smoke folder.
Build checks use Wrangler dry-run commands.
Operators verify the public endpoints after deployment.

## Deployment flow

1. The operator selects a Worker project, an environment, and a Git branch.
2. The validation job checks access rules and the selected folder.
3. The deploy job selects the shared GitHub environment.
4. GitHub applies the environment protection rules.
5. The deploy job installs dependencies and checks both source files.
6. Wrangler deploys the selected source file to its configured target.

The workflow uses the commit captured when the operator starts the run.
Dev branches share the same dev target.
A new branch does not create a new Cloudflare Worker.

## Source files and targets

A **Worker project** is a folder in this repository.
A **target** is an existing Worker in Cloudflare.

The clock project has these source and target pairs:

```text
clock-api + dev  → clock.dev.js  → cloudflare-workers-clock-dev
clock-api + prod → clock.prod.js → cloudflare-workers-clock-prod
```

[wrangler.jsonc](workers/clock-api/wrangler.jsonc) defines each pair under `env.dev` and `env.prod`.

- `main` identifies the JavaScript entrypoint.
- `name` identifies the Cloudflare target.
- `vars.ENVIRONMENT` identifies the environment inside the Worker.
- `vars.GIT_SHA` supplies the default value `local`.

Wrangler's `main` property does not identify the Git branch.
The configuration has no default entrypoint.
Deployment requires `--env dev` or `--env prod`.

GitHub supplies `GITHUB_SHA` for the selected commit.
The deploy command replaces the default `GIT_SHA` value with that commit:

```sh
npm run deploy --workspace "workers/$WORKER" -- --env "$DEPLOY_ENVIRONMENT" --var "GIT_SHA:$GITHUB_SHA"
```

`DEPLOY_ENVIRONMENT` comes from the manual environment input.
The two source files can contain different code.
A successful dev deployment does not verify the prod source.

## Secrets and URL variables

The repository secret `CLOUDFLARE_ACCOUNT_ID` identifies the shared Cloudflare account.

Each GitHub environment contains:

- Secret `CLOUDFLARE_DEPLOYMENT_TOKEN`: that environment's deployment credential.
- Variable `WORKER_URL_CLOCK_API`: that environment's public clock URL.

The secret name is the same in both environments.
The secret values are different.
GitHub hides saved secret values.

Wrangler requires the runner variable `CLOUDFLARE_API_TOKEN`.
The workflow supplies it from the renamed GitHub secret:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DEPLOYMENT_TOKEN }}
```

These credentials authorize deployment.
They are not Worker runtime bindings.

### URL selection for multiple Workers

Each project has a separate URL variable in each shared GitHub environment.

```text
clock-api     → WORKER_URL_CLOCK_API
fixture-cache → WORKER_URL_FIXTURE_CACHE
```

The workflow replaces folder-name hyphens with underscores.
It then changes the name to uppercase and adds `WORKER_URL_`.

For `clock-api`, the `dev` environment contains the dev clock URL.
The `prod` environment contains the prod clock URL.

```yaml
environment:
  name: ${{ inputs.environment }}
  url: ${{ vars[needs.validate.outputs.worker_url_variable] }}
```

The URL supplies the deployment link in GitHub.
Wrangler's target name determines the actual deployment destination.
The workflow stops before deployment if the URL variable is empty.

## Access rules

The current personal repository uses these rules:

- `sdzfg347` can deploy dev from a selected branch.
- `sdzfg347` can deploy prod from `main`.
- `theideasaler` can deploy dev from a selected branch.
- The workflow rejects prod deployments from `theideasaler`.

The shared `prod` environment requires approval from `sdzfg347`.
It permits the `main` branch only.
This environment does not permit administrator bypass.
GitHub permits self-review for this one-owner demo.

The `main` branch requires the `validate` check and one pull-request approval for ordinary contributors.
The existing branch rule permits administrator bypass.

Cloudflare uses two account-owned tokens:

- `dev_workers_deployment_token`: Individual Workers Editor on the selected dev targets.
- `prod_workers_deployment_token`: Individual Workers Editor on the selected prod targets.

Each token currently selects only its clock target.
Both tokens also have account-level Workers Metadata Read-only.
Wrangler needs this read permission for the account's `workers.dev` subdomain lookup.

This read permission permits metadata and observability access across the account.
Script-content and edit access remain limited to each token's selected targets.
A token name alone does not restrict access.

Dev branches can execute code with the dev credential.
That credential must not permit prod changes.

The configured tokens expire at **2026-10-18 23:59 UTC**.
This is **19 October 2026, 10:59 AEDT**.
Replace the tokens before this time.

## Check the project locally

Use Node.js 24.

1. Open a terminal in the repository root.
2. Install the locked dependencies:

   ```sh
   npm ci
   ```

3. Check both environment configurations:

   ```sh
   npm run check
   ```

A successful check confirms that Wrangler can package both source files.
It does not deploy a Worker or verify deployment permissions.

For local server commands, use the [clock Worker instructions](workers/clock-api/README.md).

## Deploy the clock Worker

Before a feature-branch deployment, merge or rebase the latest `main` into that branch.
This gives the branch the current workflow and variable names.

1. Open GitHub **Actions**.
2. Select **Deploy Worker**.
3. Select **Run workflow**.
4. Select the branch.
5. Select Worker `clock-api`.
6. Select environment `dev` or `prod`.
7. Select **Run workflow** to start the run.
8. For prod, approve the deployment as the configured reviewer.
9. Confirm that the deployment job succeeds.
10. Open the selected target's health endpoint.
11. Compare its `commit` value with the workflow commit.
12. Check its `environment` and `entrypoint` values.

Use `main` for prod.

- [Dev health endpoint](https://cloudflare-workers-clock-dev.n-liu.workers.dev/health)
- [Prod health endpoint](https://cloudflare-workers-clock-prod.n-liu.workers.dev/health)

These URLs return JSON.
They are public test APIs.

## Add another Worker

1. Create `workers/<worker-name>` with a lowercase name and hyphens.
2. Add separate dev and prod source files.
3. Add a package with `deploy` and `check` commands.
4. Configure both targets and entrypoints in `wrangler.jsonc`.
5. Add a README with the function, commands, owner, verification steps, and available task links.
6. Update the root lock file with `npm install --package-lock-only`.
7. Add the folder name to `worker.options` in `.github/workflows/deploy.yml`.
8. Create both targets in Cloudflare.
9. Add the dev target to the dev token's selected resources.
10. Add the prod target to the prod token's selected resources.
11. Add the project's URL variable to the shared `dev` environment.
12. Add the same variable name, with the prod URL, to the shared `prod` environment.
13. Check both source files.
14. Deploy dev from a selected branch.
15. Verify the dev endpoint.
16. Deploy prod from `main` after approval.
17. Verify the prod endpoint.

The existing environments, tokens, and prod approval rules serve the new project.
GitHub requires a workflow edit for each new dropdown option.
The workflow selects the new URL variable without a URL-specific workflow edit.
