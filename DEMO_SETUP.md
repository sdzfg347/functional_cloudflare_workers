# Personal-account demo: GitHub Actions to Cloudflare Workers

Follow this guide to reproduce the manual deployment flow using your own GitHub repository and Cloudflare account. For organization teams and company repositories, use [SETUP.md](./SETUP.md).

Documentation checked: 2026-10-01. Dashboard labels can change; the permissions and configuration values below are the important parts.

## What you will build

- One GitHub monorepo with two projects: `workers/health-api` and `workers/clock-api`.
- Four Cloudflare test Workers: dev and prod for each project.
- CI that runs tests and build validation on pushes and pull requests.
- A manual deployment form with a Worker dropdown, environment dropdown, and branch selector.
- Dev deployments from selected branches; prod deployments from `main` with your approval.

In this guide, `prod` means a second demo target. It does not require a paid Cloudflare plan or a real production domain.

## Minimum access and prerequisites

| Who or credential | Access needed | Why |
| --- | --- | --- |
| You, setting up GitHub | Owner/Admin of your own repository | Configure Actions, environments, variables, secrets and protection rules |
| Optional developer collaborator | Repository Write access; no Admin access | Push feature branches and start manual workflows |
| GitHub Actions `GITHUB_TOKEN` | `contents: read` | Check out the selected commit; provided automatically by GitHub |
| You, bootstrapping Cloudflare | Workers Admin at product scope; ability to provision account API tokens | Create the four targets and their deployment credentials |
| Normal Cloudflare deployment token | Workers Editor, scoped to one existing Worker | Upload and deploy that specific target |

On your own Cloudflare account, your account-owner access normally covers bootstrap. A delegated setup user needs API Token Provisioning capability or Super Administrator status to create account-owned tokens, and can grant only permissions they themselves have. Those are human setup privileges; do not grant them to a deployment token. [Cloudflare account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)

You also need Git, Node.js 24, npm, and a web browser. GitHub CLI is optional. Use an isolated Cloudflare account containing only demo resources.

### Free-plan choice

For the complete demo, use a **public GitHub repository** on GitHub Free. A private Free repository does not support this environment-secret setup. GitHub Pro supports private-repository environments, but private-repository required deployment reviewers need an eligible Enterprise plan. Do not assume paying for Pro alone reproduces the prod approval gate. [GitHub environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

Cloudflare Workers Free is sufficient for these small test endpoints within its usage limits. A purchased domain is unnecessary. [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Step 1: create your GitHub repository

1. Sign in to GitHub as the account that will own the demo.
2. Select **New repository**.
3. Name it, for example, `my-cloudflare-workers-demo`.
4. Select **Public**.
5. Leave the README, license and `.gitignore` initialization options empty; you will copy the existing project next.
6. Create the repository and record its HTTPS clone URL.

The repository owner will be the initial deployment operator and prod approver. You do not need an organization, a GitHub Team, or a separate GitHub App for this personal demo.

## Step 2: copy the demo into your repository

In a terminal, replace `YOUR_GITHUB_LOGIN` and the destination repository name with your values:

```sh
git clone https://github.com/sdzfg347/functional_cloudflare_workers.git my-cloudflare-workers-demo
cd my-cloudflare-workers-demo
git remote set-url origin https://github.com/YOUR_GITHUB_LOGIN/my-cloudflare-workers-demo.git
git remote -v
```

Confirm that both fetch and push URLs now point to **your repository**. These commands copy code and history; GitHub environment settings, collaborators, branch rules and secret values are not copied.

If Git asks you to authenticate for the later push, use your normal GitHub Git credentials, SSH setup, or GitHub CLI login. The deployment workflow does not need a GitHub personal access token stored as a secret.

Check the local runtime:

```sh
node --version
npm --version
```

Use Node.js 24; the project and workflow are configured for it. Then validate the copied project:

```sh
npm ci
npm test
npm run check
```

Expected: tests pass and Wrangler dry-runs all four configurations. **Dry-run validates packaging; it does not prove that a Cloudflare token can deploy.** No Cloudflare deployment credential is required for these local checks.

## Step 3: adapt the workflow to your GitHub identity

Open `.github/workflows/manual-deploy.yml`. The source demo contains an allowlist for `sdzfg347` and `theideasaler`; those are not your identities.

For a single-person personal repository, replace only the `if` expression in `jobs.validate` with:

```yaml
if: >-
  (inputs.environment == 'dev' || inputs.environment == 'prod') &&
  github.ref_type == 'branch' &&
  github.actor == github.repository_owner &&
  (inputs.environment == 'dev' || github.ref == 'refs/heads/main')
```

This uses your personal repository owner automatically. It permits the owner to deploy dev from any branch and prod only from `main`. Keep the separate `deploy` job and its dependency on successful validation.

Retain the predefined Worker dropdown:

```yaml
worker:
  description: Worker project
  type: choice
  required: true
  default: health-api
  options:
    - health-api
    - clock-api
```

Retain `dev` and `prod` as the environment choices. GitHub cannot generate this dropdown from folders, so adding another Worker later means adding its folder name to `options`.

### Workflow permissions

Both workflows should retain:

```yaml
permissions:
  contents: read
```

For this implementation, do not add `contents: write`, `actions: write`, `pull-requests: write`, `deployments: write` or `id-token: write`. Cloudflare uses its separate API token. Keep the pinned checkout/setup-node Actions and the `persist-credentials: false` checkout setting.

If you restrict allowed Actions under **Settings → Actions → General**, allow the pinned `actions/checkout` and `actions/setup-node` used in the YAML.

## Step 4: prepare your Cloudflare account

1. Sign in to your own Cloudflare dashboard and select your demo account.
2. Open **Workers & Pages**; in some navigation layouts this is under **Compute**.
3. Note your **Account ID**.
4. Note or register the account's **workers.dev subdomain**, for example `my-demo.workers.dev`.

The account ID identifies the destination. The API token authenticates deployment access. They are different values.

You do not need to install Cloudflare's GitHub integration. GitHub Actions will connect to Cloudflare through the deployment API. Leave native Git Builds unconfigured for this manual deployment flow.

## Step 5: create the four Cloudflare targets

The easiest least-privilege bootstrap is to create the Workers through the dashboard using your human account, before creating scoped deployment tokens.

For each name below:

1. In **Workers & Pages**, select **Create application** or **Create app**.
2. Choose **Start with Hello World**.
3. Enter the exact Worker name.
4. Select **Deploy**.
5. Record the resulting URL.

Use these names if you keep the repository's existing Wrangler files:

| Folder selected in GitHub | Wrangler environment | Cloudflare Worker name |
| --- | --- | --- |
| `health-api` | `dev` | `cloudflare-workers-poc-dev` |
| `health-api` | `prod` | `cloudflare-workers-poc-prod` |
| `clock-api` | `dev` | `cloudflare-workers-clock-dev` |
| `clock-api` | `prod` | `cloudflare-workers-clock-prod` |

Names are scoped to your Cloudflare account, so these may match the original demo's names. Your account subdomain makes the public URLs different.

If you choose different names, update `env.dev.name` and `env.prod.name` in each project's `wrangler.jsonc` to match. Keep folder names `health-api` and `clock-api` for this first reproduction; the smoke test expects those service identities.

Initially these targets return Hello World. The GitHub deployment replaces that with the project's code.

## Step 6: create the minimum deployment tokens

For a `workers.dev`-only deployment to pre-existing targets, start with **Workers Editor scoped to the individual target**. New-Worker creation requires product-level Workers Admin, which is why Step 5 happens first. Routes/custom-domain changes require additional zone permission; this demo does not change them. [Cloudflare Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/)

Create four account-owned tokens:

1. Open **Manage account → Account API tokens → Create Token**.
2. Give the token a descriptive name, for example `github-health-api-dev`.
3. Choose **Start from scratch** or the custom-policy option.
4. Select the scope **Specified Workers**.
5. Select exactly `cloudflare-workers-poc-dev` for this first token.
6. Select **Individual Workers → Editor**.
7. Finish or close the policy editor and confirm there is only the intended policy.
8. Choose an expiry, for example 30 days, and record the renewal date.
9. Select **Review token** or **Continue to summary**.
10. Check the target and role, then select **Create token**.
11. Copy the value shown once into a password manager until you store it in GitHub.
12. Repeat for the other three Workers, selecting the correct target each time.

Use a different token value for each target. Token names and identical GitHub secret names do not establish permission isolation; the Cloudflare policies do.

A minimal credential for these applications needs no Pages, KV, R2, D1, DNS, API-token-management or zone-route write permissions. It also needs no permission to manage the GitHub repository. Adding resources or domain configuration later requires a separate review of the operations performed.

### Compatibility fallback from the tested demo

On 2026-09-18, the original demo's scoped Editor token was valid but deployment failed during Wrangler preflight. It subsequently deployed with Wrangler 4.134.0 and Cloudflare's **Edit Cloudflare Workers** account-token template. Both the CLI and credential changed; that result does not prove which change resolved it, or prove that the template is minimal.

If your scoped token fails:

1. Check the error's endpoint, selected account, exact Worker name, token expiry, and GitHub environment secret.
2. Confirm that the Worker already exists and that the policy selects it.
3. Test the supported Wrangler version and retry the scoped credential.
4. If a one-person functional demo is still blocked, create a temporary **Edit Cloudflare Workers** account-owned token using the documented CI template. Review its permissions; it is broader than the minimum above. Restrict it to your isolated demo account, set a short expiry, and revoke it after the experiment. [Cloudflare GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

**Before inviting a dev-only collaborator, ensure the dev tokens cannot modify prod Workers.** An account-wide token used by dev can authorize prod changes directly through Cloudflare, even if the GitHub prod environment requires approval. Separate secret names or duplicate tokens with the same broad scope do not fix that. If scoped deployment is unavailable, use separate dev/prod Cloudflare accounts and environment-level account-ID variables, or keep the broad-token fallback limited to a solo experiment.

## Step 7: create GitHub variables and environments

Open your repository's **Settings → Secrets and variables → Actions → Variables**. Create this **repository variable**:

```text
Name:  CLOUDFLARE_ACCOUNT_ID
Value: your Cloudflare Account ID
```

The YAML reads `vars.CLOUDFLARE_ACCOUNT_ID`, so putting this only in Secrets will not satisfy the existing workflow.

Then open **Settings → Environments** and create exactly these names:

```text
health-api-dev
health-api-prod
clock-api-dev
clock-api-prod
```

In each environment, add:

- **Environment secret:** `CLOUDFLARE_API_TOKEN`, with that target's token value.
- **Environment variable:** `WORKER_URL`, with that target's HTTPS base URL.

For account subdomain `my-demo.workers.dev`, the mapping is:

| GitHub environment | `WORKER_URL` | Secret value to select |
| --- | --- | --- |
| `health-api-dev` | `https://cloudflare-workers-poc-dev.my-demo.workers.dev` | Token for the health dev target |
| `health-api-prod` | `https://cloudflare-workers-poc-prod.my-demo.workers.dev` | Token for the health prod target |
| `clock-api-dev` | `https://cloudflare-workers-clock-dev.my-demo.workers.dev` | Token for the clock dev target |
| `clock-api-prod` | `https://cloudflare-workers-clock-prod.my-demo.workers.dev` | Token for the clock prod target |

Replace `my-demo` with your actual account subdomain. Copy URLs from your Cloudflare dashboard rather than retaining `n-liu.workers.dev` from the source demo. `scripts/smoke.mjs` requests `/health` at the configured URL.

Environment secrets are released only to jobs referencing their environment after its protection rules pass. GitHub does not let you read a saved secret value back; updating replaces it. [GitHub environment secrets](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [GitHub secrets reference](https://docs.github.com/en/actions/reference/security/secrets)

## Step 8: set deployment protection rules

For **health-api-dev** and **clock-api-dev**:

1. Set **Deployment branches and tags → No restriction**.
2. Do not add a required reviewer for the solo demo.

This is intentional branch testing. Arbitrary branches can execute code with the dev credential, so that credential must be limited to dev resources.

For **health-api-prod** and **clock-api-prod**:

1. Set **Deployment branches and tags → Selected branches and tags**.
2. Add a rule of type **Branch**, with name `main`. Do not add a Tag rule.
3. Enable **Required reviewers** and choose your GitHub login.
4. Leave **Prevent self-review** off for a one-person demo, so you can approve a run you started.
5. If available, turn off **Allow administrators to bypass configured protection rules** to demonstrate the approval gate consistently.
6. Save the settings.

Required reviewers are approvers, not a list of who may start a run. The workflow owner check separately governs who may start a deployment job. [GitHub reviewer and branch rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

## Step 9: publish your adjusted code and confirm CI

Commit the identity and configuration changes to your repository:

```sh
git add .github/workflows/manual-deploy.yml workers/health-api/wrangler.jsonc workers/clock-api/wrangler.jsonc
git commit -m "Configure personal Cloudflare deployment demo"
git push -u origin main
```

If you did not change the Worker names, the Wrangler files will have no changes to commit. The workflow identity change is still required.

In GitHub:

1. Open **Actions** and enable Actions if asked.
2. Open the **Validate Worker** run triggered by your push.
3. Confirm tests and `npm run check` pass.
4. Confirm that no manual deployment started automatically.
5. Confirm the repository's default branch is `main`.

The deployment workflow must exist on the default branch for manual dispatch. Starting it requires repository Write access; as owner you already have that. [GitHub manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

## Step 10: deploy both projects to dev

1. Open **Actions → Manual Deploy Worker → Run workflow**.
2. Select branch **main**, Worker **health-api**, environment **dev**.
3. Run the workflow.
4. Confirm **Validate Worker folder**, **Deploy selected Worker**, and the smoke test pass.
5. Open the health dev URL followed by `/health`.
6. Repeat for Worker **clock-api**, environment **dev**.
7. Open the clock dev URL followed by `/time`.

An expected health response is:

```json
{
  "service": "health-api",
  "environment": "dev",
  "commit": "<the 40-character Git commit from this run>",
  "release": "1.0.0"
}
```

The clock API reports `service: clock-api`; `/time` also returns a `utc` field. These are JSON test APIs, so a JSON page in the browser is expected.

## Step 11: deploy both projects to prod

1. Start another manual run from **main**, Worker **health-api**, environment **prod**.
2. Confirm validation completes and deployment waits for approval.
3. Select **Review deployments**, choose **health-api-prod**, then **Approve and deploy**.
4. Confirm deployment and smoke verification pass.
5. Repeat for **clock-api/prod**, approving **clock-api-prod**.
6. Check both prod URLs and confirm `environment: prod` and the run's commit SHA.

Record the run URLs and deployed commits. A successful dev run alone does not verify prod secrets or approval rules.

## Step 12: test feature branches and target isolation

Create a feature branch containing a harmless README change:

```sh
git switch -c feature/demo-branch
```

Edit the README in your editor, then:

```sh
git add README.md
git commit -m "Exercise feature-branch deployment"
git push -u origin feature/demo-branch
```

1. Wait for CI and confirm the push did not deploy anything.
2. Run **health-api/dev** manually with **feature/demo-branch** selected.
3. Confirm its `/health` response reports the feature commit.
4. Confirm the other dev Worker and both prod Workers still report their earlier commits.
5. Try **health-api/prod** from that same feature branch. Its deployment must be skipped by the branch condition, or blocked by the environment gate if the workflow condition has been changed.
6. Return to **main** when finished. Future deployments use the commit selected at dispatch; branches share each Worker's dev target, rather than creating a new Worker per branch.

To check narrow Cloudflare credential scope without changing another target, use the dev token for an authenticated read of the intended Worker's source and of a prod Worker's source. The first should succeed and the second should be denied. Verify the token policy as well; do not use token-verification success or a packaging dry-run as proof of resource isolation.

## Step 13: optionally add a dev-only collaborator

Do this after the owner flow works and Cloudflare dev/prod credential isolation is confirmed.

1. Invite the developer through **Settings → Collaborators**. Grant Write access, not Admin.
2. Ask them to accept the invitation.
3. Replace `jobs.validate.if` with the following, substituting their GitHub login for `YOUR_DEV_LOGIN`:

```yaml
if: >-
  (inputs.environment == 'dev' || inputs.environment == 'prod') &&
  github.ref_type == 'branch' &&
  (github.actor == github.repository_owner || github.actor == 'YOUR_DEV_LOGIN') &&
  (inputs.environment == 'dev' || github.ref == 'refs/heads/main') &&
  (github.actor == github.repository_owner || inputs.environment == 'dev')
```

4. Keep prod environments restricted to `main` and approved only by the owner.
5. Before giving collaborators access, protect `main`: require the `validate` CI check and a pull-request review; disable force pushes and deletion. Have the owner review deployment-related changes. A single-person setup can leave review requirements off until this stage.
6. Have the collaborator run dev from a feature branch and attempt prod from `main`.
7. Expected: dev succeeds; prod jobs are skipped for the collaborator.

The actor check in a branch's workflow can be edited by someone with Write access. The external prod environment rules and Cloudflare token scopes are the additional boundaries. Never put an account-wide prod-capable credential into a dev environment and describe the resulting setup as secure dev-only access.

Personal repositories do not have GitHub Teams. Use [SETUP.md](./SETUP.md) when moving this pattern to an organization.

## Step 14: rotate credentials and finish the demo

1. Create a replacement scoped token with the same intended target and permissions.
2. Replace that target's GitHub environment secret.
3. Run a manual deployment and confirm the smoke test.
4. Revoke the previous token.
5. Repeat for the other targets when needed and record the expiry dates.

Creating a replacement first avoids invalidating working credentials before GitHub is updated. Cloudflare's **Roll token** action invalidates the previous value: if it was reused in multiple environments, update every affected secret before relying on those environments again.

After the experiment, remove the demo tokens and Workers when you no longer need them. Store token values in neither Git history, Markdown instructions, screenshots, nor public Actions logs.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No Run workflow button | Workflow exists on the default branch, includes `workflow_dispatch`, and your GitHub account has Write access |
| Validation and deployment are skipped | Replace the source usernames or use the owner-based expression; check selected branch and environment |
| Worker-folder validation fails | Select `health-api` or `clock-api`; ensure `package.json` and `wrangler.jsonc` exist at that commit |
| Failure before deployment steps | Inspect environment branch rules; dev should use No restriction, prod Branch `main` |
| Empty account ID | Add repository variable `CLOUDFLARE_ACCOUNT_ID`; the workflow reads `vars`, not `secrets`, for this value |
| Empty deployment token | Pre-create the exact `<folder>-<environment>` GitHub environment and its `CLOUDFLARE_API_TOKEN` secret |
| Cloudflare authentication error 10000 | Check token validity, target scope, account ID and failing API endpoint; see Step 6 compatibility notes |
| Node engine error | Use Node.js 24 locally and leave the Node setup step in CI |
| Prod waits indefinitely | Approve the job as the configured reviewer; turn off Prevent self-review for a solo demo |
| Deployment passes but smoke verification fails | Update `WORKER_URL` to your own account subdomain and confirm the service name/environment/commit |
| Secrets appear to have no values in the UI | Expected: GitHub hides saved secret values; replace the secret if unsure |

## Completion checklist

- [ ] My repository remote points to my own GitHub account.
- [ ] My workflow uses my identity or the owner-based check.
- [ ] All four Cloudflare Workers exist with matching Wrangler names.
- [ ] Four correctly named GitHub environments have the right tokens and URLs.
- [ ] `CLOUDFLARE_ACCOUNT_ID` is a repository variable.
- [ ] CI passes without a Cloudflare credential.
- [ ] Pushes do not deploy automatically.
- [ ] Both projects deploy to dev and prod; prod waits for my approval.
- [ ] A feature-branch dev deployment succeeds and leaves other targets unchanged.
- [ ] Feature-branch prod deployment is prevented.
- [ ] If collaborators are involved, dev tokens cannot authorize prod operations.
- [ ] Expiry and rotation dates are recorded; no secret value was committed.

## Adding another demo Worker

Add `workers/<name>` with its own source, tests, package and Wrangler configuration; update the npm lock file; add `<name>` to the predefined Worker dropdown; create its dev/prod Cloudflare targets, narrow tokens, and matching GitHub environments. Ensure its `/health` response uses the folder name as `service` so the shared smoke test can verify it. Follow Steps 10–12 again for the new project.
