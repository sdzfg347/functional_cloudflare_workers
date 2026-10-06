# Personal-account demo: GitHub Actions to Cloudflare Workers

Follow this complete guide to create the demo in your own GitHub repository, connect it to your own Cloudflare account, and verify manual deployments. Start with an empty repository and two new test Workers. All required configuration values and instructions are included below.

Documentation checked: 2026-10-01. Dashboard labels can change; the permissions and configuration values below are the important parts.

## What you will build

- One GitHub workspace project: `workers/clock-api`, containing `clock.dev.js` and `clock.prod.js`.
- Two Cloudflare test Workers: clock dev and clock prod.
- CI that builds both environment configurations on pushes and pull requests.
- A manual deployment form with a Worker dropdown, environment dropdown, and branch selector.
- Dev deployments from selected branches; prod deployments from `main` with your approval.

In this guide, `prod` means a second demo target. It does not require a paid Cloudflare plan or a real production domain.

Complete Steps 1–12 to reproduce the flow as one developer. Step 13 adds an optional second developer; Step 14 covers credential rotation and cleanup.

## Minimum access and prerequisites

| Who or credential | Access needed | Why |
| --- | --- | --- |
| You, setting up GitHub | Owner/Admin of your own repository | Configure Actions, environments, variables, secrets and protection rules |
| Optional developer collaborator | Repository Write access; no Admin access | Push feature branches and start manual workflows |
| GitHub Actions `GITHUB_TOKEN` | `contents: read` | Check out the selected commit; provided automatically by GitHub |
| You, setting up your Cloudflare account | Account-owner access | Create test Workers and deployment tokens through the dashboard |
| Normal Cloudflare deployment token | Workers Editor, scoped to one existing Worker | Upload and deploy that specific target |

Use the owner of your personal Cloudflare account for setup. Creating account-owned API tokens requires token-provisioning access or Super Administrator status. These are human setup privileges; the deployment token needs only the permissions for its Worker. [Cloudflare account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)

You also need Git, Node.js 24, npm, a text editor, and a web browser. GitHub CLI is optional. Use a Cloudflare account containing only demo resources.

The two credentials have separate purposes: GitHub's automatically generated `GITHUB_TOKEN` checks out the repository; your `CLOUDFLARE_API_TOKEN` authorizes Wrangler to publish a Worker. GitHub repository access does not grant access to Cloudflare.

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

The repository owner will be the initial deployment operator and prod approver.

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

Check the local tools:

```sh
git --version
node --version
npm --version
```

`node --version` must report `v24.x.x`. If you already use nvm, select that runtime with:

```sh
nvm install 24
nvm use 24
```

Otherwise, install Node.js 24 using your preferred installer or version manager before proceeding. Then validate the copied project:

```sh
npm ci
npm run check
```

Expected: Wrangler dry-runs the clock dev and prod configurations. **Dry-run validates packaging; it does not prove that a Cloudflare token can deploy.** No Cloudflare deployment credential is required for these local checks.

## Step 3: adapt the workflow to your GitHub identity

Open `.github/workflows/deploy.yml` in your text editor. The copied file contains an allowlist for the source repository's users. Replace it so your own account can deploy.

For a single-person personal repository, find `jobs` → `validate` → `if`. Replace only that expression with the following, keeping the existing indentation:

```yaml
if: >-
  (inputs.environment == 'dev' || inputs.environment == 'prod') &&
  github.ref_type == 'branch' &&
  github.actor == github.repository_owner &&
  (inputs.environment == 'dev' || github.ref == 'refs/heads/main')
```

This uses your personal repository owner automatically. It permits the owner to deploy dev from any branch and prod only from `main`. Keep the separate `deploy` job and its dependency on successful validation. Save the file; you will commit this change in Step 9.

Retain the predefined Worker dropdown:

```yaml
worker:
  description: Worker project
  type: choice
  required: true
  default: clock-api
  options:
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

In your GitHub repository, open **Settings → Actions → General** and make sure Actions is enabled. If you restrict allowed Actions, allow the pinned `actions/checkout` and `actions/setup-node` used in the YAML. Under **Workflow permissions**, choose the read-only option. The YAML's explicit `contents: read` is sufficient for this flow.

## Step 4: prepare your Cloudflare account

1. Create a personal Cloudflare account if you do not have one, and complete email verification.
2. Sign in to the Cloudflare dashboard and select your own account. Workers Free is sufficient for this demo.
3. Open **Workers & Pages**; in some navigation layouts this is under **Compute**.
4. Copy the **Account ID** shown in the account details. Keep it available for Step 7.
5. Note or register the account's **workers.dev subdomain**, for example `my-demo.workers.dev`.

The account ID identifies the destination. The API token authenticates deployment access. They are different values.

GitHub Actions connects to Cloudflare through the deployment API using the token you will create. When creating Workers, choose Hello World rather than Connect GitHub; this keeps Cloudflare's separate automatic Git Builds out of the manual deployment flow.

## Step 5: create the two Cloudflare targets

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
| `clock-api` | `dev` | `cloudflare-workers-clock-dev` |
| `clock-api` | `prod` | `cloudflare-workers-clock-prod` |

Worker names are scoped to your Cloudflare account. Use the names in this table to match the copied code; your account subdomain makes the public URLs unique to your account.

If you choose different Worker names, update `env.dev.name` and `env.prod.name` in `workers/clock-api/wrangler.jsonc` to match. Keep the `clock-api` folder and its two source files for this reproduction. `env.dev.main` selects `clock.dev.js`; `env.prod.main` selects `clock.prod.js`.

Initially these targets return Hello World. The GitHub deployment replaces that with the project's code.

## Step 6: create the minimum deployment tokens

For a `workers.dev`-only deployment to pre-existing targets, start with **Workers Editor scoped to the individual target**. New-Worker creation requires product-level Workers Admin, which is why Step 5 happens first. Routes/custom-domain changes require additional zone permission; this demo does not change them. [Cloudflare Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/)

Create two account-owned tokens:

1. Open **Manage account → Account API tokens → Create Token**.
2. Give the token a descriptive name, for example `github-clock-api-dev`.
3. Choose **Start from scratch** or the custom-policy option.
4. Select the scope **Specified Workers**.
5. Select exactly `cloudflare-workers-clock-dev` for this first token.
6. Select **Individual Workers → Editor**.
7. Finish or close the policy editor and confirm there is only the intended policy.
8. Choose an expiry, for example 30 days, and record the renewal date.
9. Select **Review token** or **Continue to summary**.
10. Check the target and role, then select **Create token**.
11. Copy the value shown once into a password manager until you store it in GitHub. Complete the success dialog with **Confirm** or **Done** after saving it.
12. Repeat for the prod Worker, selecting the correct target. Record the token name, selected Worker and expiry so you can identify each token when configuring GitHub.

Use a different token value for each target. Token names and identical GitHub secret names do not establish permission isolation; the Cloudflare policies do.

A minimal credential for these applications needs no Pages, KV, R2, D1, DNS, API-token-management or zone-route write permissions. It also needs no permission to manage the GitHub repository. Adding resources or domain configuration later requires a separate review of the operations performed.

### If a scoped token cannot deploy

A valid token can still lack permission for a particular API call made by Wrangler. Diagnose the failing request before changing the scope. The broad **Edit Cloudflare Workers** template grants more permissions than an individual-Worker Editor token and should not be presented as the minimum.

If your scoped token fails:

1. Check the error's endpoint, selected account, exact Worker name, token expiry, and GitHub environment secret.
2. Confirm that the Worker already exists and that the policy selects it.
3. Test the supported Wrangler version and retry the scoped credential.
4. If a one-person functional demo is still blocked, create a temporary account-owned token using the documented **Edit Cloudflare Workers** CI template. Follow the same token-creation steps, selecting that template instead of the custom individual-Worker policy. Restrict it to your isolated demo account, review its additional permissions, and set a short expiry. In Step 7, store it in the affected environment secret. This is a compatibility fallback, not the minimum-permission path. [Cloudflare GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

**Before inviting a dev-only collaborator, ensure the dev tokens cannot modify prod Workers.** An account-wide token used by dev can authorize prod changes directly through Cloudflare, even if the GitHub prod environment requires approval. Separate secret names or duplicate tokens with the same broad scope do not fix that. If scoped deployment is unavailable, use separate dev/prod Cloudflare accounts and environment-level account-ID secrets, or keep the broad-token fallback limited to a solo experiment.

If you use separate accounts, create the dev targets in the dev account and the prod targets in the prod account. In Step 7, add `CLOUDFLARE_ACCOUNT_ID` as an **environment secret** in each GitHub environment, with the corresponding account's ID, instead of using one shared repository value. Use tokens and Worker URLs from that same account. The existing `secrets.CLOUDFLARE_ACCOUNT_ID` expression will read the selected environment's secret.

## Step 7: create GitHub secrets, variables and environments

Open your repository's **Settings → Secrets and variables → Actions → Secrets**. Select **New repository secret**, enter the following, and select **Add secret**:

```text
Name:  CLOUDFLARE_ACCOUNT_ID
Value: your Cloudflare Account ID
```

The YAML reads `secrets.CLOUDFLARE_ACCOUNT_ID`. Store this value as a secret, not a repository variable. An account ID identifies the destination rather than granting access, but this demo stores it as a secret so its value is hidden in the GitHub settings and masked in Actions logs.

Then open **Settings → Environments**. Select **New environment**, enter a name, and select **Configure environment**. Repeat for both exact names:

```text
clock-api-dev
clock-api-prod
```

Open each environment's settings and add:

- Under **Environment secrets**, select **Add environment secret**. Set the name to `CLOUDFLARE_API_TOKEN`, paste that target's token value, and save it.
- Under **Environment variables**, select **Add environment variable**. Set the name to `WORKER_URL`, enter that target's HTTPS base URL, and save it.

For account subdomain `my-demo.workers.dev`, the mapping is:

| GitHub environment | `WORKER_URL` | Secret value to select |
| --- | --- | --- |
| `clock-api-dev` | `https://cloudflare-workers-clock-dev.my-demo.workers.dev` | Token for the clock dev target |
| `clock-api-prod` | `https://cloudflare-workers-clock-prod.my-demo.workers.dev` | Token for the clock prod target |

Replace `my-demo` with your actual account subdomain. Copy the URL from each Worker's Cloudflare dashboard; the source repository's URLs belong to a different account. `WORKER_URL` supplies the public link shown on GitHub deployment records; open `/health` or `/time` manually after deploying.

Do not store the Cloudflare token as a repository variable. Do not create only `dev` and `prod` GitHub environments: the workflow constructs `<worker-folder>-<environment>`, so the two names above must match exactly.

Environment secrets are released only to jobs referencing their environment after its protection rules pass. GitHub does not let you read a saved secret value back; updating replaces it. [GitHub environment secrets](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [GitHub secrets reference](https://docs.github.com/en/actions/reference/security/secrets)

## Step 8: set deployment protection rules

For **clock-api-dev**:

1. Set **Deployment branches and tags → No restriction**.
2. Do not add a required reviewer for the solo demo.

This is intentional branch testing. Arbitrary branches can execute code with the dev credential, so that credential must be limited to dev resources.

For **clock-api-prod**:

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
git add .github/workflows/deploy.yml workers/clock-api/wrangler.jsonc
git commit -m "Configure personal Cloudflare deployment demo"
git push -u origin main
```

If you did not change the Worker names, the Wrangler files will have no changes to commit. The workflow identity change is still required.

In GitHub:

1. Open **Actions** and enable Actions if asked.
2. Open the **Build Worker** run triggered by your push.
3. Confirm `npm run check` passes for both source files.
4. Confirm that no manual deployment started automatically.
5. Confirm the repository's default branch is `main`. If necessary, choose `main` under **Settings → General → Default branch**.

The deployment workflow must exist on the default branch for manual dispatch. Starting it requires repository Write access; as owner you already have that. [GitHub manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

## Step 10: deploy the clock Worker to dev

1. Open **Actions → Deploy Worker → Run workflow**.
2. Select branch **main**, Worker **clock-api**, environment **dev**.
3. Run the workflow.
4. Confirm **Validate Worker folder**, **Validate selected Worker build**, and **Deploy selected Worker** pass.
5. Open the clock dev URL followed by `/health`; verify its environment, entrypoint and commit.
6. Open the clock dev URL followed by `/time` to see the current UTC timestamp.

An expected clock health response is:

```json
{
  "service": "clock-api",
  "environment": "dev",
  "entrypoint": "clock.dev.js",
  "commit": "<the 40-character Git commit from this run>",
  "release": "1.0.0"
}
```

The prod source identifies `clock.prod.js`; `/time` also returns a `utc` field. These are JSON test APIs, so a JSON page in the browser is expected.

## Step 11: deploy the clock Worker to prod

1. Start another manual run from **main**, Worker **clock-api**, environment **prod**.
2. Confirm the validation job completes and the deployment job shows **Waiting**.
3. On the workflow run page, select **Review deployments**, choose **clock-api-prod**, then **Approve and deploy**.
4. Confirm build validation and deployment pass.
5. Open the clock prod URL and confirm `environment: prod`, `entrypoint: clock.prod.js`, and the run's commit SHA.

Record the run URLs and deployed commits. A successful dev run alone does not verify prod source, secrets or approval rules.

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
2. Run **clock-api/dev** manually with **feature/demo-branch** selected.
3. Confirm its `/health` response reports the feature commit.
4. Confirm the prod clock Worker still reports its earlier commit.
5. Try **clock-api/prod** from that same feature branch. Its deployment must be skipped by the branch condition, or blocked by the environment gate if the workflow condition has been changed.
6. Return to `main` with `git switch main` when finished. Future deployments use the commit selected at dispatch; branches share each Worker's dev target, rather than creating a new Worker per branch.

In Cloudflare, open **Manage account → Account API tokens**, select each token and view its policy summary. Verify that each dev token selects only its intended dev Worker. Successful deployment proves the token can deploy its target; reviewing its scope checks which other resources it could access. A token-verification request or packaging dry-run alone does not establish resource isolation.

## Step 13: optionally add a dev-only collaborator

Do this after the owner flow works and Cloudflare dev/prod credential isolation is confirmed.

1. Note the developer's GitHub login. You will add them after protecting the repository.
2. Replace `jobs.validate.if` with the following, substituting their GitHub login for `YOUR_DEV_LOGIN`. Commit and push this workflow change to `main` while you are still the only operator:

```yaml
if: >-
  (inputs.environment == 'dev' || inputs.environment == 'prod') &&
  github.ref_type == 'branch' &&
  (github.actor == github.repository_owner || github.actor == 'YOUR_DEV_LOGIN') &&
  (inputs.environment == 'dev' || github.ref == 'refs/heads/main') &&
  (github.actor == github.repository_owner || inputs.environment == 'dev')
```

3. Keep the prod environment restricted to `main`, approved only by the owner, with administrator bypass disabled.
4. Open **Settings → Branches → Add branch protection rule**. Enter `main`, enable **Require a pull request before merging**, require one approval, and enable **Require status checks to pass before merging** with the `validate` check. Dismiss stale approvals and leave force pushes and deletion disabled. Save the rule. Have the owner review deployment-related changes. A single-person setup can leave review requirements off until this stage.
5. Open **Settings → Collaborators → Add people**, find the developer and send the invitation. A normal collaborator on a personal repository receives Write access; they do not need repository administration or Cloudflare account access.
6. Ask them to accept the invitation and run dev from a feature branch, then attempt prod from `main`.
7. Expected: dev succeeds; prod jobs are skipped for the collaborator. Record both run URLs to verify the behavior under their actual login.

The actor check in a branch's workflow can be edited by someone with Write access. The external prod environment rules and Cloudflare token scopes are the additional boundaries. Never put an account-wide prod-capable credential into a dev environment and describe the resulting setup as secure dev-only access.

## Step 14: rotate credentials and finish the demo

1. Create a replacement scoped token with the same intended target and permissions.
2. Replace that target's GitHub environment secret.
3. Run a manual deployment and manually verify its endpoint identity.
4. Revoke the previous token.
5. Repeat for the other targets when needed and record the expiry dates.

Creating a replacement first avoids invalidating working credentials before GitHub is updated. Cloudflare's **Roll token** action invalidates the previous value: if it was reused in multiple environments, update every affected secret before relying on those environments again.

After the experiment, remove the demo tokens and Workers when you no longer need them. Store token values in neither Git history, Markdown instructions, screenshots, nor public Actions logs.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No Run workflow button | Workflow exists on the default branch, includes `workflow_dispatch`, and your GitHub account has Write access |
| Validation and deployment are skipped | Replace the source usernames or use the owner-based expression; check selected branch and environment |
| Worker-folder validation fails | Select `clock-api`; ensure `package.json` and `wrangler.jsonc` exist at that commit |
| Failure before deployment steps | Inspect environment branch rules; dev should use No restriction, prod Branch `main` |
| Empty account ID | Add repository secret `CLOUDFLARE_ACCOUNT_ID`; the workflow reads `secrets`, not `vars`, for this value |
| Empty deployment token | Pre-create the exact `<folder>-<environment>` GitHub environment and its `CLOUDFLARE_API_TOKEN` secret |
| Cloudflare authentication error 10000 | Check token validity, target scope, account ID and failing API endpoint; see Step 6 compatibility notes |
| Node engine error | Use Node.js 24 locally and leave the Node setup step in CI |
| Prod waits indefinitely | Approve the job as the configured reviewer; turn off Prevent self-review for a solo demo |
| Deployment succeeds but the endpoint looks wrong | Check the Worker URL, selected source, environment and commit manually |
| Secrets appear to have no values in the UI | Expected: GitHub hides saved secret values; replace the secret if unsure |

## Completion checklist

- [ ] My repository remote points to my own GitHub account.
- [ ] My workflow uses my identity or the owner-based check.
- [ ] Both Cloudflare Workers exist with matching Wrangler names.
- [ ] Two correctly named GitHub environments have the right tokens and URLs.
- [ ] `CLOUDFLARE_ACCOUNT_ID` is a repository secret.
- [ ] CI passes without a Cloudflare credential.
- [ ] Pushes do not deploy automatically.
- [ ] Clock dev and prod deploy successfully; prod waits for my approval.
- [ ] A feature-branch dev deployment succeeds and leaves other targets unchanged.
- [ ] Feature-branch prod deployment is prevented.
- [ ] If collaborators are involved, dev tokens cannot authorize prod operations.
- [ ] Expiry and rotation dates are recorded; no secret value was committed.

## Adding another demo Worker

Add `workers/<name>` with its own README, source, package and Wrangler configuration; update the npm lock file; add `<name>` to the predefined Worker dropdown; create its dev/prod Cloudflare targets, narrow tokens, and matching GitHub environments. Provide a `check` script that dry-runs both environments, and document how to verify the actual endpoint manually. Follow Steps 10–12 again for the new project.
