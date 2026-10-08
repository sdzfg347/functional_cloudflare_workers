# Health API Worker

This independent test Worker returns its status and deployment identity.
It demonstrates a second project in the shared deployment workflow.
It does not check the clock Worker or external services.

## Folder structure

```text
workers/health-api/
├── README.md
├── health.dev.js
├── health.prod.js
├── package.json
└── wrangler.jsonc
```

The dev and prod files are separate entrypoints.
Each source requires its matching `ENVIRONMENT` value.

## Targets

```text
health-api + dev  → health.dev.js  → cloudflare-workers-poc-dev
health-api + prod → health.prod.js → cloudflare-workers-poc-prod
```

These are the existing health targets from the original POC.
The project folder name does not need to match the Cloudflare target name.
`wrangler.jsonc` defines the mapping.

- [Dev health endpoint](https://cloudflare-workers-poc-dev.n-liu.workers.dev/health)
- [Prod health endpoint](https://cloudflare-workers-poc-prod.n-liu.workers.dev/health)

`workers_dev: true` enables these normal Worker addresses.
`preview_urls: false` disables version-specific URLs.
Wrangler deploys by account ID and target name.
It does not use the public URL to select the target.

## API behavior

- `GET /` and `GET /health` return status 200 with deployment identity.
- `HEAD` on these paths returns headers without a body.
- Other methods return status 405 with `Allow: GET, HEAD`.
- Unknown paths with `GET` or `HEAD` return status 404.
- A valid path returns status 503 if the environment binding is missing or incorrect.

Responses use `Cache-Control: no-store`.
The API requires no authentication.
It has no database, scheduled task, or external dependency.

Example dev response:

```json
{
  "status": "ok",
  "service": "health-api",
  "environment": "dev",
  "entrypoint": "health.dev.js",
  "commit": "<workflow commit>",
  "release": "1.0.0"
}
```

The prod response identifies `health.prod.js` and environment `prod`.
`status: ok` confirms that the handler runs with the expected environment configuration.
It is not a health check for other applications.

## Configuration

- `ENVIRONMENT`: `dev` or `prod`, from Wrangler configuration.
- `GIT_SHA`: `local` by default, or the selected workflow commit during deployment.
- `CLOUDFLARE_ACCOUNT_ID`: the shared repository secret.
- `CLOUDFLARE_DEPLOYMENT_TOKEN`: the credential from the selected GitHub environment.
- `WORKER_URL_HEALTH_API`: this project's base URL in that GitHub environment.

The workflow passes the deployment credential to Wrangler as `CLOUDFLARE_API_TOKEN`.
Credentials are not Worker runtime bindings.
The URL variable supplies the GitHub deployment link.

The shared dev token selects the clock dev and health dev targets.
The shared prod token selects the clock prod and health prod targets.
Both tokens have account-level Workers Metadata Read-only for the subdomain lookup.

Prod requires `main` and the shared prod approval rule.
The [repository instructions](../../README.md) describe the current user access rules.

## Check and develop locally

Use Node.js 24.

1. Open a terminal in the repository root.
2. Install dependencies:

   ```sh
   npm ci
   ```

3. Check both health configurations:

   ```sh
   npm run check --workspace workers/health-api
   ```

4. Start the dev source:

   ```sh
   npm run dev --workspace workers/health-api
   ```

5. Open `/health` at the local URL that Wrangler displays.
6. Check the response.
7. Stop the server with **Ctrl+C**.

To start the prod source locally:

```sh
cd workers/health-api
npx --no-install wrangler dev --env prod
```

The `check` command packages both sources without deployment.
It does not verify Cloudflare permissions.

## Deploy and verify

1. Open GitHub **Actions → Deploy Worker**.
2. Select **Run workflow**.
3. Select a branch for dev, or `main` for prod.
4. Select Worker `health-api`.
5. Select the environment.
6. Start the workflow.
7. For prod, approve the deployment as the configured reviewer.
8. Confirm that the deployment job succeeds.
9. Open the selected health target's `/health` endpoint.
10. Confirm `status: ok` and `service: health-api`.
11. Check the environment and entrypoint.
12. Compare `commit` with the workflow commit.
13. Confirm that the other health target retains its previous deployment.
14. Confirm that the clock targets retain their previous deployments.

Each workflow run deploys one selected Worker and environment.
The same shared GitHub environment can contain deployments for both projects.

## Correct a failure

- **Status 503:** Check the environment binding and selected source.
- **Missing entrypoint:** Supply `--env dev` or `--env prod`.
- **Empty URL:** Add `WORKER_URL_HEALTH_API` to the selected GitHub environment.
- **Cloudflare error 10000:** Check the token's selected health target and metadata read permission.
- **Wrong service:** Check the URL and selected project.
- **Prod waits:** Approve the deployment as the configured reviewer.

An authorized Cloudflare operator can restore a known working version from the target's **Deployments** page.
Verify the endpoint after a restore.
GitHub environment rules do not control dashboard restores.

## Owner and references

- Owner: `sdzfg347`.
- ClickUp task reference: none supplied for this Worker.
- [Build workflow](../../.github/workflows/build.yml)
- [Deployment workflow](../../.github/workflows/deploy.yml)
- [Wrangler configuration](wrangler.jsonc)
