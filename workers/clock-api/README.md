# Clock API Worker

This test Worker returns its deployment identity and the current UTC time.
It handles HTTP requests only.
It has no database, scheduled task, queue consumer, or external API dependency.

## Folder structure

```text
workers/clock-api/
├── README.md
├── clock.dev.js
├── clock.prod.js
├── package.json
└── wrangler.jsonc
```

- `clock.dev.js` contains the dev implementation.
- `clock.prod.js` contains the prod implementation.
- `package.json` defines the commands for this npm workspace.
- `wrangler.jsonc` selects the entrypoint, target, and runtime variables.

The two source files currently provide the same API.
Each file checks its expected environment and returns its own entrypoint name.
Future changes can make their behavior different.

## Targets

```text
Wrangler dev  → clock.dev.js  → cloudflare-workers-clock-dev
Wrangler prod → clock.prod.js → cloudflare-workers-clock-prod
```

Wrangler's `main` property identifies the source entrypoint.
The Git branch selection is separate.
The configuration requires an explicit `--env dev` or `--env prod`.

Health addresses:

- [Dev](https://cloudflare-workers-clock-dev.n-liu.workers.dev/health)
- [Prod — disabled for testing](https://cloudflare-workers-clock-prod.n-liu.workers.dev/health)

These endpoints belong to the POC account.
A copy of this project uses the new account's `workers.dev` subdomain.

The top-level `workers_dev: true` setting enables the dev address.
The prod override sets `workers_dev: false` for the current URL test.
`preview_urls: false` disables version-specific URLs in both environments.
The prod public `/health` and `/time` addresses do not serve the Worker during this test.
Local development still permits both source files.

## API behavior

- `GET /` and `GET /health` return deployment identity.
- `GET /time` also returns the current UTC timestamp.
- `HEAD` on these paths returns headers without a response body.
- Other HTTP methods return status 405 and header `Allow: GET, HEAD`.
- An unknown path with `GET` or `HEAD` returns status 404.
- A valid path returns status 503 if `ENVIRONMENT` is missing or does not match the source.

Responses use `Cache-Control: no-store`.
The API requires no authentication.
Its response fields contain no deployment credentials.

Example response from the dev `/time` endpoint:

```json
{
  "service": "clock-api",
  "environment": "dev",
  "entrypoint": "clock.dev.js",
  "commit": "<deployment commit>",
  "release": "1.0.0",
  "utc": "2026-10-06T00:00:00.000Z"
}
```

The `utc` value changes with each request.
The prod response identifies `clock.prod.js`.

## Configuration

### Worker runtime variables

- `ENVIRONMENT`: `dev` or `prod`, from the selected Wrangler environment.
- `GIT_SHA`: `local` by default, or the workflow commit during deployment.

The deploy command replaces the default `GIT_SHA` value.
The Worker returns that value as `commit`.

### GitHub deployment configuration

- Repository secret `CLOUDFLARE_ACCOUNT_ID` identifies the Cloudflare account.
- Environment secret `CLOUDFLARE_DEPLOYMENT_TOKEN` supplies the selected environment's credential.
- Environment variable `WORKER_URL_CLOCK_API` supplies the selected environment's clock URL.

Both shared environments contain the same secret and variable names.
Their token and URL values differ.

The workflow passes the token to Wrangler as `CLOUDFLARE_API_TOKEN`.
It derives `WORKER_URL_CLOCK_API` from the folder name `clock-api`.
The URL controls the GitHub deployment link.
The Wrangler target name controls the deployment destination.

The dev token permits edits to the dev target.
The prod token permits edits to the prod target.
Both tokens have account-level Workers Metadata Read-only for the `workers.dev` lookup.

Prod uses the shared `prod` approval rules and permits the `main` branch only.
The [repository instructions](../../README.md) describe the current user access rules.

## Check the source files

Use Node.js 24.

1. Open a terminal in the repository root.
2. Install dependencies:

   ```sh
   npm ci
   ```

3. Check both clock configurations:

   ```sh
   npm run check --workspace workers/clock-api
   ```

This command packages both entrypoints without deployment.
It does not verify endpoint behavior or Cloudflare permissions.

## Start a local server

1. Start the dev source from the repository root:

   ```sh
   npm run dev --workspace workers/clock-api
   ```

2. Open the local URL that Wrangler displays.
3. Add `/health` or `/time` to that URL.
4. Check the response.
5. Stop the server with **Ctrl+C**.

To inspect the prod source:

1. Open a terminal in `workers/clock-api`.
2. Start the prod source:

   ```sh
   npx --no-install wrangler dev --env prod
   ```

3. Check the local `/health` and `/time` responses.
4. Stop the server with **Ctrl+C**.

A local response normally reports `commit: local`.

## Deploy and verify

Prod currently has no enabled public address.
For prod, verify the successful Actions run and the target's Cloudflare **Deployments** page.
Use the HTTP verification steps below for dev, or after you restore the prod address.

1. Open GitHub **Actions → Deploy Worker**.
2. Select **Run workflow**.
3. Select a branch for dev, or `main` for prod.
4. Select Worker `clock-api`.
5. Select the environment.
6. Start the workflow.
7. For prod, approve the deployment as the configured reviewer.
8. Confirm that the deployment job succeeds.
9. Open the selected target's `/health` endpoint.
10. Check the environment and entrypoint.
11. Compare the response commit with the workflow commit.
12. Open `/time`.
13. Check the UTC timestamp.
14. Confirm that the other target retains its previous deployment.

## Correct a failure

- **Prod URL does not respond:** This is expected while `env.prod.workers_dev` is `false`.
- **Status 503:** Check `ENVIRONMENT` and the selected source file.
- **Missing entrypoint:** Supply `--env dev` or `--env prod`.
- **Empty deployment value:** Check the repository secret and the selected environment's secret and URL variable.
- **Cloudflare error 10000:** Check the account, token expiry, selected targets, and required read permission.
- **Wrong response identity:** Check the target URL and workflow commit.
- **Prod job waits:** Approve the deployment as the configured reviewer.

To restore an earlier deployment:

1. Open the target in the Cloudflare dashboard.
2. Open **Deployments**.
3. Select a known working version.
4. Restore that version.
5. Verify the endpoint identity.

A dashboard restore requires Cloudflare access.
The GitHub approval rule does not control dashboard operations.

To restore the prod address, set `env.prod.workers_dev` to `true` and deploy prod after approval.

## Owner and references

- Owner: `sdzfg347`.
- ClickUp reference: none supplied for this test Worker.
- [Build workflow](../../.github/workflows/build.yml)
- [Deployment workflow](../../.github/workflows/deploy.yml)
- [Wrangler configuration](wrangler.jsonc)

Add the actual ClickUp task URL when a task applies.
