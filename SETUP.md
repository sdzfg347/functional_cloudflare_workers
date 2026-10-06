# Company setup guide: GitHub Actions to a Cloudflare Workers monorepo

This guide describes the minimum permissions and repeatable setup for a company-owned repository containing multiple Cloudflare Workers.

The target model is:

- Developers can manually deploy `dev` from any selected branch.
- Production deployments can run only from `main`.
- Production deployments require approval from a release team.
- The same workflow supports multiple Worker projects.
- All Workers share one dev credential and a separate prod credential, each scoped to an explicit list of matching Cloudflare targets.
- The manual Worker selector uses a predefined dropdown and validates the selected folder before deployment.
- No Cloudflare token is committed to Git or printed in logs.

The proof-of-concept repository uses these files and folders:

```text
workers/
  clock-api/
    README.md
    clock.dev.js
    clock.prod.js
    package.json
    wrangler.jsonc
.github/workflows/build.yml
.github/workflows/deploy.yml
package.json
package-lock.json
```

## 1. Decide the ownership model

For a company repository, transfer or create the repository under a GitHub organization, for example:

```text
bet-technology/functional_cloudflare_workers
```

GitHub Teams are organization resources. A personal-account repository such as `sdzfg347/functional_cloudflare_workers` cannot use `bet-technology/leads` as a team permission or environment reviewer.

Create these teams:

| Team | Minimum repository role | Purpose |
| --- | --- | --- |
| `developers` | Write | Push feature branches, run CI, manually deploy dev |
| `leads` | Read or Write | Approve production deployments; use Write if leads also run workflows |
| `platform-admins` | Admin | Configure repository settings, environments, branch rules, and secrets |

Do not give every developer repository Admin or Maintain access. Repository Write access is enough for normal development and workflow dispatch. Only repository administrators should configure branch protection, environment rules, and secrets.

## 2. Configure the GitHub repository

### Branch protection for `main`

Configure `main` with:

- Required `validate` status check from `build.yml`.
- At least one approving pull-request review.
- Dismiss stale approvals after new commits.
- Required conversation resolution.
- No force pushes.
- No branch deletion.
- Direct pushes disabled for normal contributors.

Repository administrators may bypass rules only when the company policy permits emergency changes. Keep bypass events auditable.

This protects the deployment workflow itself. Without protection, a contributor could edit the workflow on `main` and remove the production restrictions.

### GitHub Actions permissions

Set the default workflow token permissions to read-only where possible. The workflows in this repository explicitly use:

```yaml
permissions:
  contents: read
```

The workflow does not need:

- `id-token: write` because it uses a Cloudflare API token rather than OIDC.
- `contents: write`.
- `deployments: write` for the current workflow.
- `pull-requests: write`.
- `actions: write`.

Pin third-party Actions to full commit SHAs. The current example pins `actions/checkout` and `actions/setup-node`. Also restrict the organization’s allowed Actions to the exact Actions used by the repository, plus reviewed internal Actions.

GitHub recommends explicit workflow permissions and full-length SHA pinning for supply-chain protection: [GitHub Actions security hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats).

## 3. Configure GitHub environments

Create two shared environments for the entire repository:

```text
dev
prod
```

Every Worker deployment uses one of these environments. Configure the common production approval policy once on `prod`.

### Dev environment

Configure the dev environment with:

- No deployment branch restriction, so feature branches can be tested.
- A `CLOUDFLARE_DEPLOYMENT_TOKEN` environment secret.
- A `WORKER_URL` environment variable for the deployment link.

The workflow itself still allows dev only for members of the development group. Repository Write permission is the normal control for who can dispatch the workflow.

### Prod environment

Configure the prod environment with:

- Deployment branch policy: selected branch `main`.
- Required reviewer: the `leads` team.
- `Prevent self-review` enabled if the person who starts a deployment must not approve their own deployment.
- Administrator bypass disabled so the approval gate also applies to repository administrators.
- A separate `CLOUDFLARE_DEPLOYMENT_TOKEN` environment secret.
- A `WORKER_URL` environment variable for the deployment link.

Environment secrets are unavailable to a job until its protection rules pass. This is the key control that keeps the production Cloudflare token away from an unapproved run. GitHub supports users or teams as required reviewers: [GitHub deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

For private repositories, verify that the organization plan supports environment secrets, deployment branch policies, and required reviewers. GitHub documents plan requirements here: [Managing environments for deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## 4. Store GitHub variables and secrets

Create one repository secret under **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

```text
CLOUDFLARE_ACCOUNT_ID=<company Cloudflare account ID>
```

Create these values once in each shared GitHub environment:

```text
Variable: WORKER_URL
Secret:   CLOUDFLARE_DEPLOYMENT_TOKEN
```

Example mapping:

| GitHub environment | `WORKER_URL` | Token scope |
| --- | --- | --- |
| `dev` | `https://cloudflare-workers-clock-dev.<account>.workers.dev` | Editor on the selected dev Worker list |
| `prod` | `https://cloudflare-workers-clock-prod.<account>.workers.dev` | Editor on the selected prod Worker list |

The single `WORKER_URL` works for the current clock-only POC. For several projects, use per-worker URL variables or a reviewed mapping and update the workflow's deployment link selection to use the validated Worker name. Sharing approval rules does not imply sharing an endpoint.

GitHub never displays a secret value after it is saved. Seeing only the secret name and lock icon is expected. To change it, overwrite it with a newly generated value.

Do not use repository-level Cloudflare tokens when environment-level tokens can be used. A repository-level token would be available to every deployment job, including dev jobs.

## 5. Create Cloudflare Worker targets first

For least privilege, create the Worker targets before creating deployment tokens. Use stable names:

```text
<worker>-dev
<worker>-prod
```

For example:

```text
cloudflare-workers-clock-dev
cloudflare-workers-clock-prod
```

Creating the Workers first is important because Cloudflare per-Worker permissions cannot be assigned to a Worker that does not exist yet. Cloudflare requires product-level Workers Admin to create a new Worker, while Editor is sufficient to update and deploy an existing Worker: [Cloudflare Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/).

For a company setup, prefer creating the Worker targets through an approved platform process or Cloudflare infrastructure code. Avoid granting the GitHub deployment token product-level Admin.

## 6. Create Cloudflare deployment tokens

Use account-owned API tokens for CI/CD rather than a personal user token. Cloudflare’s GitHub Actions documentation requires an API token and account ID for non-interactive Wrangler authentication: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

### Steady-state minimum target

Create two account-owned tokens, one per environment boundary:

```text
dev_workers_deployment_token  -> Editor on the selected dev Workers
prod_workers_deployment_token -> Editor on the selected prod Workers
```

In **Manage account → Account API tokens → Create Token**, set the name, choose **Start from scratch**, choose **Specified Workers**, select all intended targets for that environment, and select **Individual Workers → Editor**. Close the editor, set an expiry, review the exact resource list, then create the token. Copy its one-time value into the matching GitHub environment secret `CLOUDFLARE_DEPLOYMENT_TOKEN`. Repeat for the opposite environment with a different value.

The token name is descriptive. Resource selection enforces access. Do not choose account-wide Workers Editor for dev when dev and prod share an account. Future Workers are not added automatically: create their targets first, then update the matching token's selected Worker list.

The token needs:

- Cloudflare Workers `Editor` role.
- Scope limited to the selected individual Workers in one environment.
- An expiry date and documented rotation owner.

It does not need:

- Account Admin.
- Pages Write.
- R2 Write.
- KV Write.
- D1 Write.
- Workers Routes Write when the Worker only uses its existing `workers.dev` URL.

Cloudflare states that deploying an existing Worker requires Editor access. Existing bindings do not require separate permissions on KV, R2, or D1 merely to deploy the Worker. Separate resource permissions are required only when CI directly creates or manages those resources: [Cloudflare Workers roles](https://developers.cloudflare.com/workers/authorization/workers/).

### Routes and custom domains

If a deployment changes a route or custom domain, add:

```text
Zone > Workers Routes > Write
```

for the affected zone. Keep that permission out of tokens that only deploy to `workers.dev`.

### Bootstrap exception

If CI must create Workers, use a short-lived product-level Workers Admin token only for bootstrap. After the Workers exist:

1. Create the dev and prod Editor tokens with separate selected Worker lists.
2. Replace the GitHub environment secrets.
3. Revoke the bootstrap Admin token.
4. Confirm a normal deployment works with the scoped token.

Do not leave a product-level Admin token in GitHub Actions as the permanent solution.

### Wrangler permission compatibility check

Cloudflare’s role model supports per-Worker Editor access, but the exact Wrangler/API endpoint must be tested whenever Wrangler changes. Run this before using a token broadly:

```sh
CLOUDFLARE_API_TOKEN="$TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" \
npx wrangler whoami

CLOUDFLARE_API_TOKEN="$TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" \
npx --no-install wrangler deploy --config workers/<worker>/wrangler.jsonc --env dev --dry-run
```

A dry-run only checks packaging; it does not authenticate a real deployment. Confirm an actual dev deployment and an approved prod deployment, then verify that the dev token is denied access to prod resources. `whoami` may require broader identity-listing access than deployment; do not broaden the deployment token merely to make that command pass.

If the current Wrangler returns Cloudflare error `10000` for a per-Worker token, treat that as a permission compatibility issue. Test the current Wrangler release and inspect the exact endpoint permissions before broadening the token. A temporary account-level `Edit Cloudflare Workers` token is a controlled fallback for a proof of concept, not the preferred company steady state.

## 7. Configure each Worker project

Each Worker should own its Wrangler configuration:

```jsonc
{
  "name": "company-worker",
  "compatibility_date": "YYYY-MM-DD",
  "workers_dev": true,
  "preview_urls": false,
  "env": {
    "dev": {
      "name": "company-worker-dev",
      "main": "worker.dev.js",
      "vars": { "ENVIRONMENT": "dev", "GIT_SHA": "local" }
    },
    "prod": {
      "name": "company-worker-prod",
      "main": "worker.prod.js",
      "vars": { "ENVIRONMENT": "prod", "GIT_SHA": "local" }
    }
  }
}
```

Keep `vars` for non-sensitive configuration only. Use Cloudflare Worker secrets for runtime secrets, and keep local `.dev.vars*` and `.env*` files in `.gitignore`.

Use one root `package-lock.json` with npm workspaces. Pin Wrangler at the root and use a supported Node.js LTS version in CI.

## 8. Configure the workflow for an organization

For an organization-owned repository, repository and environment permissions should provide the team boundary. The workflow does not need a hardcoded user allowlist.

Use a `choice` input for the Worker folder. GitHub `workflow_dispatch` choice options are static YAML values, so add each new Worker to the options list when onboarding it. Validate the selected folder after checkout, then use the validated output to select the GitHub environment. The job condition should validate the environment and require `main` only for prod:

```yaml
if: >-
  (inputs.environment == 'dev' || inputs.environment == 'prod') &&
  (inputs.environment == 'dev' || github.ref == 'refs/heads/main')
```

The validation job should reject path traversal and non-standard folder names before the deployment job receives an environment secret:

```yaml
- name: Validate Worker folder
  id: validate-worker
  env:
    WORKER: ${{ inputs.worker }}
  shell: bash
  run: |
    set -euo pipefail
    if ! printf '%s' "$WORKER" | grep -Eq '^[a-z0-9][a-z0-9-]*$'; then
      exit 1
    fi
    test -f "workers/$WORKER/package.json"
    test -f "workers/$WORKER/wrangler.jsonc"
    echo "worker=$WORKER" >> "$GITHUB_OUTPUT"
```

The deployment job uses `needs.validate.outputs.worker` in workspace commands and `inputs.environment` as its shared GitHub environment name. Folder validation runs before the deployment job receives its environment credential.

The job should reference the selected environment:

```yaml
environment:
  name: ${{ inputs.environment }}
  url: ${{ vars.WORKER_URL }}
```

The deployment step should receive only the selected environment’s values:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DEPLOYMENT_TOKEN }}
```

`CLOUDFLARE_DEPLOYMENT_TOKEN` is the GitHub secret name; `CLOUDFLARE_API_TOKEN` is Wrangler's required runner variable. Rename the secret reference, not the variable Wrangler reads.

Keep these controls in the workflow:

- `workflow_dispatch` only for deployment.
- `contents: read` permissions.
- Checkout at `${{ github.sha }}`.
- Node.js 24 or the supported company standard.
- `npm ci`.
- Build validation before deployment with Wrangler dry-run.
- Concurrency grouped by Worker and environment.
- Manual endpoint verification after deployment.
- Full SHA-pinned Actions.

Do not use `github.actor == 'team-name'`. GitHub Teams are not workflow actors. Use repository team permissions and environment required reviewers instead.

## 9. First company setup sequence

Use this order for a new company repository:

1. Create or transfer the repository into the company GitHub organization.
2. Create `developers`, `leads`, and `platform-admins` teams.
3. Grant `developers` Write access and grant `platform-admins` Admin access.
4. Protect `main` with pull-request review and the CI validation check.
5. Create the monorepo root and one Worker folder.
6. Create the dev and prod Worker targets in Cloudflare.
7. Create dev/prod account-owned Editor tokens scoped to separate selected target lists.
8. Create shared `dev` and `prod` GitHub environments.
9. Add `CLOUDFLARE_DEPLOYMENT_TOKEN` and the appropriate Worker URL variable to each environment; add repository secret `CLOUDFLARE_ACCOUNT_ID`.
10. Add the `leads` team as a required reviewer on prod.
11. Set prod’s deployment branch policy to `main`.
12. Leave dev without a deployment branch policy for branch testing.
13. Commit the workflow and Worker project to a feature branch.
14. Open a pull request into `main` and confirm CI passes.
15. Run a dev deployment from the feature branch.
16. Merge to `main`, run a prod deployment, and approve it as a lead.
17. Verify the endpoint, commit SHA, deployment record, and logs.
18. Rotate the token once and confirm the GitHub environment secret update process.

## 10. Add another Worker

For every future Worker:

1. Add `workers/<worker-name>` with a README, source, `package.json`, and `wrangler.jsonc`.
2. Add dev and prod Worker names to its Wrangler configuration.
3. Use a lowercase kebab-case folder name and add it to the workflow’s `worker` choice options.
4. Create the two Cloudflare Worker targets.
5. Add the new dev target to the existing dev token policy, and the prod target to the existing prod token policy.
6. Reuse shared GitHub environments `dev` and `prod`; no new environment is needed.
7. Add per-worker URL variables or extend a reviewed URL mapping, and select the correct deployment link in the workflow.
8. Confirm the shared prod reviewer, `main` policy and administrator-bypass restriction remain configured.
9. Dry-run deployment for both environments.
10. Deploy dev from a feature branch.
11. Deploy prod from `main` after review.

## 11. Rotation and incident response

Rotate a token when a team member leaves, a token may have been exposed, permissions change, or the expiry window is reached:

1. Create the replacement Cloudflare token.
2. Update the affected GitHub environment secret.
3. Run a dev deployment and manually verify the endpoint.
4. Run or approve a prod deployment as appropriate.
5. Revoke the old Cloudflare token.
6. Check GitHub Actions logs and Cloudflare audit logs.

If a token is exposed, revoke it immediately. Do not rely on GitHub masking as a replacement for revocation.

## Minimum permission summary

| Surface | Minimum permission |
| --- | --- |
| GitHub developer | Repository Write; dev environment access through repository membership |
| GitHub production approver | Read access to the repository plus membership in the prod required-reviewer team |
| GitHub platform administrator | Repository Admin and organization environment-management authority |
| GitHub Actions token | `contents: read` |
| Cloudflare steady-state deploy token | Account-owned Individual Workers Editor scoped to an explicit list of existing dev or prod Workers |
| Cloudflare Worker creation | Product-level Workers Admin, only during controlled bootstrap |
| Cloudflare route/custom-domain changes | Worker Editor plus Zone Workers Routes Write |
| Cloudflare resource creation | The specific product permission for the resource; not needed merely to deploy an existing binding |
