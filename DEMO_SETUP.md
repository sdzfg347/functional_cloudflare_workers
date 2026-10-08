# Personal demo setup

Use this guide to reproduce the repository with your own GitHub and Cloudflare accounts.
This guide contains the complete setup procedure.

The demo has two projects, `clock-api` and `health-api`, and four Cloudflare targets.
All targets are test Workers.
The name `prod` identifies the target that requires approval.

## Before you start

Use these tools and accounts:

- Git.
- Node.js 24 and npm.
- A text editor and web browser.
- A personal GitHub account.
- A Cloudflare account that you control.

Use a public GitHub repository for the free demo.
Public repositories support the environment secrets and approval rules used here.
Private repositories require an eligible plan for each protection feature.
See [GitHub environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

The test Workers can use Cloudflare Workers Free within its usage limits.
A purchased domain is unnecessary.

### Required access

- **GitHub setup operator:** the repository owner.
- **Optional collaborator:** repository Write access.
- **GitHub workflow token:** `contents: read`.
- **Cloudflare setup operator:** access to create Workers and account API tokens.
- **Cloudflare deployment tokens:** the two policies specified in Step 5.

The Cloudflare account owner can perform the setup.
Other token creators need API Token Provisioning capabilities and the permissions they grant.
Super Administrator access also permits token creation.
See [Cloudflare account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/).

GitHub supplies `GITHUB_TOKEN` automatically for repository access.
You create the Cloudflare tokens separately.
Collaborators do not need Cloudflare dashboard access to use this workflow.

## 1. Create an empty GitHub repository

1. Sign in to your personal GitHub account.
2. Select **New repository**.
3. Enter a name, for example, `my-cloudflare-workers-demo`.
4. Select **Public**.
5. Leave the README, license, and gitignore initialization options empty.
6. Create the repository.
7. Copy its HTTPS clone URL.

The following examples use `YOUR_GITHUB_LOGIN` as a placeholder.
Replace this placeholder with your GitHub login.

## 2. Copy the project

1. Open a terminal.
2. Copy the source repository:

   ```sh
   git clone https://github.com/sdzfg347/functional_cloudflare_workers.git my-cloudflare-workers-demo
   cd my-cloudflare-workers-demo
   ```

3. Set your repository as the destination:

   ```sh
   git remote set-url origin https://github.com/YOUR_GITHUB_LOGIN/my-cloudflare-workers-demo.git
   ```

4. Check the destination:

   ```sh
   git remote -v
   ```

5. Confirm that both URLs identify your repository.
6. Check your Node.js version:

   ```sh
   node --version
   ```

7. Confirm that the version starts with `v24.`.
8. Install dependencies:

   ```sh
   npm ci
   ```

9. Check all Worker configurations:

   ```sh
   npm run check
   ```

If Node.js 24 is absent, install it before Step 8.

Git copies the project files and commit history.
It does not copy GitHub secrets, environments, collaborators, or protection rules.
A successful dry-run confirms that Wrangler can package the source files.
It does not verify Cloudflare access.

### Files used by this procedure

```text
my-cloudflare-workers-demo/
├── .github/
│   └── workflows/
│       ├── build.yml
│       └── deploy.yml
├── workers/
│   ├── clock-api/
│   │   ├── README.md
│   │   ├── clock.dev.js
│   │   ├── clock.prod.js
│   │   ├── package.json
│   │   └── wrangler.jsonc
│   └── health-api/
│       ├── README.md
│       ├── health.dev.js
│       ├── health.prod.js
│       ├── package.json
│       └── wrangler.jsonc
├── .gitignore
├── DEMO_SETUP.md
├── README.md
├── package.json
└── package-lock.json
```

This tree shows the files used by the personal demo.

The root package defines `workers/*` as npm workspaces.
Each Worker has its own configuration.
All workspaces use the root lock file.

## 3. Configure your deployment identity

The source workflow names the original repository users.
Replace that condition before your first deployment.

1. Open `.github/workflows/deploy.yml`.
2. Find `jobs.validate.if`.
3. Replace its expression with the following:

   ```yaml
   if: >-
     (inputs.environment == 'dev' || inputs.environment == 'prod') &&
     github.ref_type == 'branch' &&
     github.actor == github.repository_owner &&
     (inputs.environment == 'dev' || github.ref == 'refs/heads/main')
   ```

4. Keep the existing indentation.
5. Save the file.

This condition permits your personal repository owner to deploy.
Dev accepts selected branches.
Prod accepts `main` only.

Keep the existing Worker dropdown:

```yaml
worker:
  description: Worker project
  type: choice
  required: true
  default: clock-api
  options:
    - clock-api
    - health-api
```

Keep both `dev` and `prod` environment choices.
GitHub does not generate dropdown options from repository folders.

Both workflows require this permission:

```yaml
permissions:
  contents: read
```

Keep the full commit references for `actions/checkout` and `actions/setup-node`.
Keep `persist-credentials: false`.
This workflow needs no GitHub personal access token as a repository secret.

## 4. Create the Cloudflare targets

1. Sign in to your Cloudflare account.
2. Complete email verification if Cloudflare requests it.
3. Select the account for this demo.
4. Copy the Account ID.
5. Open **Workers & Pages** under **Compute**.
6. Register the account's `workers.dev` subdomain if necessary.
7. Select **Create application** or **Create app**.
8. Select **Start with Hello World**.
9. Enter `cloudflare-workers-clock-dev` as the Worker name.
10. Select **Deploy**.
11. Copy the dev Worker's base URL.
12. Repeat Steps 7–11 with name `cloudflare-workers-clock-prod`.
13. Repeat Steps 7–11 with name `cloudflare-workers-poc-dev`.
14. Repeat Steps 7–11 with name `cloudflare-workers-poc-prod`.

Example URLs:

```text
https://cloudflare-workers-clock-dev.YOUR_SUBDOMAIN.workers.dev
https://cloudflare-workers-clock-prod.YOUR_SUBDOMAIN.workers.dev
https://cloudflare-workers-poc-dev.YOUR_SUBDOMAIN.workers.dev
https://cloudflare-workers-poc-prod.YOUR_SUBDOMAIN.workers.dev
```

Use the actual URLs from your dashboard.
Do not use the source repository's account subdomain.

The existing configuration expects these pairs:

```text
clock-api/dev  → clock.dev.js  → cloudflare-workers-clock-dev
clock-api/prod → clock.prod.js → cloudflare-workers-clock-prod
health-api/dev  → health.dev.js  → cloudflare-workers-poc-dev
health-api/prod → health.prod.js → cloudflare-workers-poc-prod
```

If you choose different target names, change `env.dev.name` and `env.prod.name` in the corresponding project's `wrangler.jsonc`.
Keep the entrypoint names.

Wrangler's `main` property identifies a JavaScript entrypoint.
It does not select a Git branch.

Create the targets before the deployment tokens.
Individual Worker permissions require an existing target.
GitHub Actions performs deployment directly through the Cloudflare API.
This procedure does not use Cloudflare Git Builds.

## 5. Create two deployment tokens

Each token requires two permission policies:

- **Individual Workers → Editor:** only the matching dev or prod targets.
- **Workers → Metadata Read-only:** account scope.

The first policy permits deployment to the selected target.
The second permits Wrangler to read the account's `workers.dev` subdomain.
It also permits metadata and observability access across the account.
It does not permit script-content reads or edits on other targets.

This combination passed deployment checks with Wrangler 4.134.0.
Individual Worker Editor alone failed the account subdomain read.
See [Cloudflare Worker permissions](https://developers.cloudflare.com/workers/authorization/workers/).

### Create the dev token

1. Open **Manage account → Account API tokens**.
2. Select **Create Token**.
3. Enter `dev_workers_deployment_token` as the name.
4. Select **Start from scratch**.
5. Select scope **Specified Workers**.
6. Select `cloudflare-workers-clock-dev` and `cloudflare-workers-poc-dev`.
7. Select **Individual Workers → Editor**.
8. Close the policy editor.
9. Select **Add policy**.
10. Keep scope **Entire Account**.
11. Search for `Workers`.
12. Select only **Workers → Metadata Read-only** in this second policy.
13. Close the policy editor.
14. Set an expiration date.
15. Record the expiration date.
16. Select **Review token** or **Continue to summary**.
17. Confirm the selected target and both permission policies.
18. Select **Create token**.
19. Save the token value in a password manager.
20. Complete the success dialog.

Cloudflare displays the token value once.
Keep the value available for Step 6.

### Create the prod token

1. Repeat the token procedure with name `prod_workers_deployment_token`.
2. Select `cloudflare-workers-clock-prod` and `cloudflare-workers-poc-prod` for the individual Worker policy.
3. Keep the account-level metadata read policy.
4. Save the separate prod token value.
5. Record its expiration date.

Use different token values for dev and prod.
The selected resources control token access.
The token name does not control access.

Do not grant account-wide Workers Editor or Admin to either deployment token.
The demo needs no Pages, KV, R2, D1, DNS, or zone-route write permission.

## 6. Configure GitHub secrets and variables

### Add the account secret

1. Open your GitHub repository.
2. Open **Settings → Secrets and variables → Actions**.
3. Select the **Secrets** tab.
4. Select **New repository secret**.
5. Enter name `CLOUDFLARE_ACCOUNT_ID`.
6. Enter your Cloudflare Account ID as the value.
7. Select **Add secret**.

The account ID identifies the account.
The deployment token authorizes changes.

### Add the shared environments

1. Open **Settings → Environments**.
2. Select **New environment**.
3. Enter `dev`.
4. Select **Configure environment**.
5. Add environment secret `CLOUDFLARE_DEPLOYMENT_TOKEN`.
6. Use the dev token value from Step 5.
7. Add environment variable `WORKER_URL_CLOCK_API`.
8. Use your dev Worker's base URL.
9. Create a second environment named `prod`.
10. Add secret `CLOUDFLARE_DEPLOYMENT_TOKEN` to `prod`.
11. Use the prod token value.
12. Add variable `WORKER_URL_CLOCK_API` to `prod`.
13. Use your prod clock Worker's base URL.
14. Add variable `WORKER_URL_HEALTH_API` to `dev` with the `cloudflare-workers-poc-dev` base URL.
15. Add variable `WORKER_URL_HEALTH_API` to `prod` with the `cloudflare-workers-poc-prod` base URL.

The names are identical in both environments.
The token and URL values differ.

The workflow selects the environment and URL as follows:

```yaml
environment:
  name: ${{ inputs.environment }}
  url: ${{ vars[needs.validate.outputs.worker_url_variable] }}
```

The validation job converts `clock-api` to `WORKER_URL_CLOCK_API`.
It converts `health-api` to `WORKER_URL_HEALTH_API`.
The deploy job reads that variable from the selected environment.
The URL supplies the GitHub deployment link.
The Wrangler target name determines the actual destination.
Wrangler does not require these URL variables.
This repository uses them for deployment links and a nonempty-value check.

Both project configurations use `workers_dev: true` and `preview_urls: false`.
The normal Worker addresses remain available when version-specific URLs are disabled.

The workflow passes credentials to Wrangler as follows:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DEPLOYMENT_TOKEN }}
```

Keep the runner variable name `CLOUDFLARE_API_TOKEN`.
Wrangler requires that name.

GitHub hides saved secret values.
A secret entry with no visible value is normal.
Do not store a deployment token as a variable or repository-level secret.

## 7. Configure deployment protection

### Dev

1. Open the `dev` environment.
2. Set **Deployment branches and tags** to **No restriction**.
3. Leave required reviewers empty for this demo.
4. Save the configuration.

Dev branches can execute code with the dev token.
Its Cloudflare policy must exclude prod edit access.

### Prod

1. Open the `prod` environment.
2. Set **Deployment branches and tags** to **Selected branches and tags**.
3. Add a **Branch** rule named `main`.
4. Enable **Required reviewers**.
5. Select your GitHub login.
6. Leave **Prevent self-review** off for this one-person demo.
7. Disable **Allow administrators to bypass configured protection rules**.
8. Save the configuration.

The workflow condition controls who can start the deployment job.
The environment rules control secret access and approval.
GitHub releases environment secrets after its protection rules pass.
See [GitHub deployment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

## 8. Publish the configuration

1. Open **Settings → Actions → General**.
2. Enable Actions if necessary.
3. Permit the pinned `actions/checkout` and `actions/setup-node` actions.
4. Set default workflow permissions to read-only.
5. Replace the example user names in the project READMEs with your user names.
6. Replace the example endpoint URLs in those READMEs with your target URLs.
7. Update the token expiration dates in the root README.
8. Save the files.
9. Commit the changes:

   ```sh
   git add .github/workflows/deploy.yml workers/clock-api/wrangler.jsonc README.md workers/clock-api/README.md
   git commit -m "Configure personal Cloudflare demo"
   ```

10. Push to your repository:

    ```sh
    git push -u origin main
    ```

11. Confirm that GitHub uses `main` as the default branch.
12. Open **Actions → Build Worker**.
13. Confirm that the build succeeds.

The first push publishes the manual workflow.
GitHub requires that workflow on the default branch before manual dispatch.
A push starts build checks only.

## 9. Deploy dev

1. Open **Actions → Deploy Worker**.
2. Select **Run workflow**.
3. Select branch `main`.
4. Select Worker `clock-api`.
5. Select environment `dev`.
6. Start the workflow.
7. Confirm that both jobs succeed.
8. Open your dev Worker's `/health` endpoint.
9. Check the environment and entrypoint.
10. Compare `commit` with the workflow commit.
11. Open `/time`.
12. Check the UTC timestamp.

Expected health response:

```json
{
  "service": "clock-api",
  "environment": "dev",
  "entrypoint": "clock.dev.js",
  "commit": "<workflow commit>",
  "release": "1.0.0"
}
```

A JSON response in the browser is correct.
The `/time` response also contains `utc`.

## 10. Deploy prod

1. Start another manual deployment from `main`.
2. Select Worker `clock-api`.
3. Select environment `prod`.
4. Confirm that the deploy job waits for approval.
5. Select **Review deployments**.
6. Select `prod`.
7. Select **Approve and deploy**.
8. Confirm that the deployment succeeds.
9. Open your prod Worker's `/health` endpoint.
10. Check for `environment: prod` and `entrypoint: clock.prod.js`.
11. Compare `commit` with the workflow commit.

Record both deployment run URLs.

### Repeat for the health project

1. Repeat Step 9 with Worker `health-api` and environment `dev`.
2. Open the `cloudflare-workers-poc-dev` health endpoint.
3. Confirm `status: ok`, `service: health-api`, and `entrypoint: health.dev.js`.
4. Repeat Step 10 with Worker `health-api` and environment `prod`.
5. Open the `cloudflare-workers-poc-prod` health endpoint.
6. Confirm `status: ok`, `service: health-api`, and `entrypoint: health.prod.js`.
7. Compare each response commit with its workflow run.
8. Confirm that the clock targets retain their previous deployments.

The health Worker is independent.
Its response does not report the health of the clock Worker.

## 11. Check feature branches

1. Create a branch:

   ```sh
   git switch -c feature/demo-branch
   ```

2. Make a small README change.
3. Commit the change:

   ```sh
   git add README.md
   git commit -m "Check feature-branch deployment"
   ```

4. Push the branch:

   ```sh
   git push -u origin feature/demo-branch
   ```

5. Confirm that the build succeeds.
6. Start a dev deployment from `feature/demo-branch`.
7. Confirm that the dev endpoint reports the feature commit.
8. Confirm that prod retains its previous commit.
9. Request a prod deployment from the same feature branch.
10. Confirm that GitHub skips the deployment.
11. Return to `main`:

    ```sh
    git switch main
    ```

A later dev deployment replaces the same dev target.
Each branch does not get a separate Worker.

## 12. Add a dev-only collaborator, if required

Complete this section before you invite the collaborator.

1. Replace `jobs.validate.if` with the following expression.
2. Replace `YOUR_DEV_LOGIN` with the collaborator's login.

```yaml
if: >-
  (inputs.environment == 'dev' || inputs.environment == 'prod') &&
  github.ref_type == 'branch' &&
  (github.actor == github.repository_owner || github.actor == 'YOUR_DEV_LOGIN') &&
  (inputs.environment == 'dev' || github.ref == 'refs/heads/main') &&
  (github.actor == github.repository_owner || inputs.environment == 'dev')
```

3. Commit the workflow change.
4. Push it to `main`.
5. Confirm that the build succeeds.
6. Open **Settings → Branches**.
7. Add a branch protection rule for `main`.
8. Require a pull request and one approving review.
9. Require the `validate` status check.
10. Require the branch to be current before merge.
11. Enable dismissal of stale approvals.
12. Require conversation resolution.
13. Leave force pushes and branch deletion disabled.
14. Save the rule.
15. Confirm that prod still requires owner approval and the `main` branch.
16. Check that the dev token selects only dev targets.
17. Open **Settings → Collaborators**.
18. Invite the collaborator with Write access.
19. Ask the collaborator to deploy dev from a feature branch.
20. Ask the collaborator to request prod from `main`.
21. Confirm that dev succeeds and GitHub skips prod jobs.

Do not give the collaborator repository administration access.
A collaborator can change the workflow on a feature branch.
The external prod environment rules and Cloudflare token scope provide additional protection.

## 13. Add another Worker

1. Add `workers/<worker-name>` with a README, package, sources, and Wrangler configuration.
2. Define `deploy` and `check` commands in its package.
3. Make `check` package both environment configurations.
4. Update the root lock file with `npm install --package-lock-only`.
5. Add the folder to the workflow's Worker dropdown.
6. Create the dev and prod Cloudflare targets.
7. Add the dev target to the existing dev token.
8. Add the prod target to the existing prod token.
9. Add the project's URL variable to both shared GitHub environments.
10. Use each environment's corresponding target URL.
11. Repeat the deployment and verification procedures for the new project.

Example URL variable: `fixture-cache` becomes `WORKER_URL_FIXTURE_CACHE`.
The workflow replaces hyphens with underscores, uses uppercase, and adds `WORKER_URL_`.
The existing prod approval rules apply to the new Worker.

## 14. Replace an expiring token

1. Create a replacement token with the same two policies and selected targets.
2. Replace `CLOUDFLARE_DEPLOYMENT_TOKEN` in the matching GitHub environment.
3. Deploy that environment.
4. Verify the endpoint.
5. Revoke the old token.
6. Record the replacement token's expiration date.

Cloudflare's **Roll token** action immediately invalidates the old value.
Create a replacement first to keep the old credential valid during setup.

## Correct a setup failure

- **No Run workflow button:** Publish `deploy.yml` on the default branch.
- **GitHub skips all deployment jobs:** Check the actor condition and selected branch.
- **Folder validation fails:** Check the selected folder and its package and Wrangler files.
- **A deployment value is empty:** Check the secret names and `WORKER_URL_CLOCK_API` in the selected environment.
- **Cloudflare error 10000:** Check the account, target selection, token expiration, and account-level metadata read policy.
- **Prod does not wait:** Check its required reviewer rule and administrator bypass setting.
- **Prod cannot get approval:** Disable prevention of self-review for a one-person demo.
- **Wrong endpoint identity:** Compare the target URL, environment, entrypoint, and workflow commit.
- **Node version fails:** Use Node.js 24.

Do not replace a restricted dev token with an account-wide edit token.
That change would permit prod changes from dev.
If your policy prohibits shared metadata access, use separate Cloudflare accounts.
Store each account ID as an environment secret in that case.

## Completion checks

- [ ] The Git remote points to my repository.
- [ ] The workflow uses my GitHub identity.
- [ ] All four Cloudflare targets exist.
- [ ] The two tokens have the required policies and separate target lists.
- [ ] GitHub contains shared `dev` and `prod` environments.
- [ ] Each environment has its own token and separate clock and health URL variables.
- [ ] The account ID is a secret.
- [ ] Build checks pass.
- [ ] Dev and approved prod deployments succeed.
- [ ] GitHub skips feature-branch prod deployments.
- [ ] Collaborator restrictions work, if a collaborator is present.
- [ ] My records contain the token expiration dates.
