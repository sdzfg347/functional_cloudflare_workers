# Company setup

Use this guide for a GitHub organization repository.
It describes setup permissions, team approval, and future Worker projects.

The deployment model uses:

- One repository with multiple Worker folders.
- Separate dev and prod source files in each folder.
- Two shared GitHub environments: `dev` and `prod`.
- One Cloudflare deployment token for each environment.
- A separate URL variable for each Worker in each environment.
- Manual dev deployments from selected branches.
- Manual prod deployments from `main` after team approval.

## 1. Confirm the required access

### GitHub

Use these repository roles:

- **Developers:** Write access to push branches and start workflows.
- **Release approvers:** Read access to approve deployments.
- **Release operators:** Write access if they also start workflows.
- **Repository administrators:** Admin access to configure environments, secrets, and protection rules.

An organization owner or authorized team manager must configure the teams.
Developers do not need repository Admin access.

### Cloudflare

Use these permissions for the setup operators:

- Workers product **Admin** to create the initial targets.
- **API Token Provisioning** capabilities to create account-owned tokens.
- The permissions that the operator will grant to those tokens.

A Super Administrator can also perform these setup operations.
The deployment tokens use the smaller permission set in Step 6.
Developers need no Cloudflare dashboard access for GitHub deployments.

Cloudflare permits token creators to grant only permissions that they hold.
See [account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/).

### GitHub plan

Confirm that the repository plan supports environment secrets, branch restrictions, and required reviewers.

Public repositories support these features on current GitHub plans.
Private repositories require an eligible Enterprise plan for required deployment reviewers.
GitHub Team alone does not provide required reviewers for private environments.
See [environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## 2. Prepare the organization repository

1. Create an empty repository in the company GitHub organization.
2. Create a development team, for example, `developers`.
3. Create a release team, for example, `leads`.
4. Create an administration team, for example, `platform-admins`.
5. Assign the repository roles from Step 1.
6. Limit administration access to the setup and maintenance operators.

GitHub teams belong to organizations.
A personal repository cannot use an organization team as its environment reviewer.

## 3. Copy the project

Use Git, Node.js 24, and npm.

1. Clone the POC:

   ```sh
   git clone https://github.com/sdzfg347/functional_cloudflare_workers.git company-cloudflare-workers
   cd company-cloudflare-workers
   ```

2. Replace `YOUR_ORG` and `YOUR_REPO` in the following command.
3. Set the company repository as the destination:

   ```sh
   git remote set-url origin https://github.com/YOUR_ORG/YOUR_REPO.git
   ```

4. Confirm the destination:

   ```sh
   git remote -v
   ```

Git copies source files and history.
It does not copy secrets, environments, or repository permissions.

### Folder structure

```text
.
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
├── SETUP.md
├── package.json
└── package-lock.json
```

The root package uses npm workspaces.
Each `workers/*` folder contains one project.
All projects use the root lock file.

A future project can use this structure:

```text
workers/fixture-cache/
├── README.md
├── fixture-cache.dev.js
├── fixture-cache.prod.js
├── package.json
└── wrangler.jsonc
```

Use Git commits or branches for old and new versions.
Keep stable source filenames for dev and prod.

## 4. Configure the organization workflow

1. Open `.github/workflows/deploy.yml`.
2. Find `jobs.validate.if`.
3. Replace the personal user condition with this expression:

   ```yaml
   if: >-
     (inputs.environment == 'dev' || inputs.environment == 'prod') &&
     github.ref_type == 'branch' &&
     (inputs.environment == 'dev' || github.ref == 'refs/heads/main')
   ```

4. Save the file.

Any repository writer can start a workflow with this company condition.
A writer can request prod, but the deploy job requires release-team approval.
The reviewer list controls approval, not who can request a run.

`github.actor` identifies a user.
It does not identify a team such as `bet-technology/leads`.

Keep these existing controls:

- Manual `workflow_dispatch` deployment.
- Static Worker choices.
- Worker-folder validation before the deploy job.
- Checkout of the captured `github.sha`.
- Node.js 24.
- `npm ci`.
- Build checks before deployment.
- A separate concurrency group for each Worker and environment.
- Full commit references for external actions.
- `persist-credentials: false`.

Keep the workflow token permission:

```yaml
permissions:
  contents: read
```

The current workflow needs no additional GitHub token permission.
It authenticates to Cloudflare with the separate deployment token.

## 5. Create the Cloudflare targets

1. Select the company Cloudflare account.
2. Copy its Account ID.
3. Open **Workers & Pages**.
4. Create a dev target with the intended Worker name.
5. Create a prod target with the intended Worker name.
6. Confirm that both targets have a `workers.dev` URL.
7. Record both base URLs.
8. Set the corresponding names in the project's `wrangler.jsonc`.

For the copied projects, the target names are:

```text
cloudflare-workers-clock-dev
cloudflare-workers-clock-prod
cloudflare-workers-poc-dev
cloudflare-workers-poc-prod
```

The `cloudflare-workers-poc-*` targets belong to the `health-api` project.
Create both environment targets for each project.

Each Wrangler environment must identify its target and source:

```jsonc
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
```

This example is the environment section of a Wrangler file.
Replace its target and source names with the actual project values.

Wrangler's `main` property identifies the JavaScript entrypoint.
It does not select the Git branch.
Keep runtime secrets outside `vars`.

Create targets before deployment tokens.
Individual Worker permissions cannot select a target that does not exist.
See [Worker roles](https://developers.cloudflare.com/workers/authorization/workers/).

## 6. Create the deployment tokens

Create one account-owned token for dev and another for prod.

```text
dev_workers_deployment_token  → selected dev targets
prod_workers_deployment_token → selected prod targets
```

Each token requires:

- **Individual Workers → Editor** on its selected targets.
- **Workers → Metadata Read-only** at account scope.

The account-level read policy permits the `workers.dev` subdomain lookup.
It also permits metadata and observability access across the account.
Script-content and edit access remain limited to the selected targets.

The POC verified this permission combination with Wrangler 4.134.0.
Without account-level metadata read, deployment failed after upload during the subdomain lookup.

### Token procedure

1. Open **Manage account → Account API tokens**.
2. Select **Create Token**.
3. Enter the dev or prod token name.
4. Select **Start from scratch**.
5. Select scope **Specified Workers**.
6. Select only that environment's existing targets.
7. Select **Individual Workers → Editor**.
8. Close the policy editor.
9. Select **Add policy**.
10. Keep scope **Entire Account**.
11. Search for `Workers`.
12. Select only **Workers → Metadata Read-only** in this policy.
13. Close the policy editor.
14. Set an expiration date.
15. Select **Review token** or **Continue to summary**.
16. Check both policies and the selected targets.
17. Create the token.
18. Save its one-time value in the approved secret store.
19. Record its owner and expiration date.
20. Repeat the procedure for the other environment.

A token name does not enforce resource selection.
Do not grant account-wide Workers Editor or Admin to a dev token.

This flow needs no Pages, KV, R2, D1, DNS, or Workers Routes write permission.
Additional infrastructure operations can require additional permissions.
Review those operations separately.

If company policy prohibits shared metadata access, use separate Cloudflare accounts for dev and prod.
In that case, store the matching Account ID as an environment secret.

## 7. Configure GitHub environments

1. Open repository **Settings → Environments**.
2. Create `dev`.
3. Create `prod`.

Use these two environments for all Worker projects.

### Dev protection

1. Open `dev`.
2. Set **Deployment branches and tags** to **No restriction**.
3. Save the configuration.

The organization workflow condition permits branches only.
A branch can execute code with the dev token.
Its Cloudflare policy must exclude prod edit access.

### Prod protection

1. Open `prod`.
2. Set **Deployment branches and tags** to **Selected branches and tags**.
3. Add a **Branch** rule named `main`.
4. Enable **Required reviewers**.
5. Select the release team.
6. Enable **Prevent self-review** if a different person must approve the run.
7. Disable administrator bypass.
8. Save the configuration.

GitHub releases the environment secret only after these rules pass.
One configured reviewer can approve a run.
The list does not require approval from every listed reviewer.
See [GitHub deployment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

## 8. Add secrets and Worker URLs

### Account secret

1. Open **Settings → Secrets and variables → Actions**.
2. Select **Secrets**.
3. Add repository secret `CLOUDFLARE_ACCOUNT_ID`.
4. Use the shared Cloudflare Account ID.

For separate Cloudflare accounts, create this secret in each environment instead.
An environment secret overrides a repository secret with the same name.

### Deployment secrets

1. Open the `dev` environment.
2. Add secret `CLOUDFLARE_DEPLOYMENT_TOKEN` with the dev token value.
3. Open the `prod` environment.
4. Add secret `CLOUDFLARE_DEPLOYMENT_TOKEN` with the prod token value.

Do not place either deployment token at repository scope.
GitHub hides saved secret values.

The workflow maps the selected secret to Wrangler's required runner variable:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DEPLOYMENT_TOKEN }}
```

### Worker URL variables

1. Open the `dev` environment.
2. Add variable `WORKER_URL_CLOCK_API` with the company's dev clock URL.
3. Open the `prod` environment.
4. Add variable `WORKER_URL_CLOCK_API` with the company's prod clock URL.
5. Add `WORKER_URL_HEALTH_API` to `dev` with the company's health dev URL.
6. Add `WORKER_URL_HEALTH_API` to `prod` with the company's health prod URL.

Each project requires a separate variable in each environment:

```text
clock-api     → WORKER_URL_CLOCK_API
health-api    → WORKER_URL_HEALTH_API
fixture-cache → WORKER_URL_FIXTURE_CACHE
```

The validation job replaces hyphens with underscores.
It then uses uppercase and adds the prefix `WORKER_URL_`.
The deploy job selects that key from the shared environment.

```yaml
environment:
  name: ${{ inputs.environment }}
  url: ${{ vars[needs.validate.outputs.worker_url_variable] }}
```

The URL supplies the GitHub deployment link.
The Wrangler target name selects the actual destination.
The workflow stops before deployment if the URL value is empty.
Wrangler itself requires no Worker URL as deployment input.
The presence check is a repository convention.

`preview_urls: false` disables version-specific URLs.
`workers_dev: true` keeps the normal Worker address enabled.
Deployment still works by target name if both address types are disabled.
Verify the deployed version through Cloudflare when no HTTP route is available.

## 9. Publish the initial configuration

1. Replace the example names and URLs in the project READMEs.
2. Update the token owners and expiration dates in the root README.
3. Open **Settings → Actions → General**.
4. Enable Actions.
5. Permit the pinned checkout and Node setup actions.
6. Set default workflow permissions to read-only.
7. Install dependencies locally:

   ```sh
   npm ci
   ```

8. Check all projects:

   ```sh
   npm run check
   ```

9. Commit the workflow, configuration, and documentation changes.
10. Publish the initial `main` branch through the company's approved setup process.
11. Set `main` as the repository default branch.
12. Confirm that **Build Worker** succeeds.

The manual workflow must exist on the default branch before manual dispatch.
Publish the initial configuration before the feature-branch deployment test.

## 10. Protect the main branch

1. Open **Settings → Branches**.
2. Create a protection rule for `main`.
3. Require pull requests.
4. Require at least one approving review.
5. Require the `validate` status check from `build.yml`.
6. Require the branch to be current before merge.
7. Enable dismissal of stale approvals.
8. Require conversation resolution.
9. Disable force pushes.
10. Disable branch deletion.
11. Configure administrator bypass according to company policy.
12. Save the rule.

The check name is `validate`, not `Build Worker`.
The build must run before GitHub can list that check.

Require review from the responsible team for workflow and deployment configuration changes.
Use a CODEOWNERS rule if company policy requires that review.

## 11. Verify the deployment flow

1. Create a feature branch with a small change.
2. Push the branch.
3. Confirm that build checks pass.
4. Deploy a Worker to dev from that branch.
5. Verify the endpoint's environment, entrypoint, and commit.
6. Confirm that prod retains its previous deployment.
7. Request prod from the feature branch.
8. Confirm that GitHub skips the deployment.
9. Merge the reviewed change to `main`.
10. Request prod from `main`.
11. Confirm that the deploy job waits for approval.
12. Approve the run as an eligible release-team member.
13. Verify the prod endpoint.
14. Record the run URLs and deployed commits.

Also inspect both Cloudflare token policies.
Confirm that the dev token grants no prod edit permission.

A packaging dry-run does not verify API permissions.
A successful dev deployment does not verify the separate prod source or credential.

## 12. Add a Worker

1. Create a lowercase project folder under `workers/`.
2. Use hyphens between words in the folder name.
3. Add the dev and prod source files.
4. Add `wrangler.jsonc` with both target and entrypoint pairs.
5. Add a unique workspace package name.
6. Add a `deploy` command that invokes `wrangler deploy`.
7. Add a `check` command that packages both environments without deployment.
8. Add a README with the required information listed below.
9. Update the lock file with `npm install --package-lock-only`.
10. Add the folder name to `worker.options` in `.github/workflows/deploy.yml`.
11. Create both Cloudflare targets.
12. Add the dev target to the dev token's selected resources.
13. Add the prod target to the prod token's selected resources.
14. Add the project's URL variable to each GitHub environment.
15. Check both source files.
16. Complete the deployment checks in Step 11.

The new project uses the existing shared environments and prod approval rules.
It does not require another token for the same environment.

Each Worker README must include:

- Purpose and owner.
- Folder structure.
- Source files and target names.
- HTTP endpoints or event triggers.
- Runtime variables, bindings, and dependencies.
- Local commands.
- Deployment and verification steps.
- Failure correction and restore instructions.
- Actual ClickUp task links or other available references.

Do not invent task links.

## 13. Replace deployment tokens

1. Create a replacement token with the same policies and selected targets.
2. Replace the matching GitHub environment secret.
3. Deploy that environment.
4. Verify the endpoint.
5. Revoke the old token.
6. Record the new expiration date.

If you suspect token exposure, revoke it immediately.
Do not wait for a normal replacement cycle.

## Correct a setup failure

- **No manual workflow:** Check that `deploy.yml` exists on the default branch.
- **Dev deployment fails branch rules:** Check the dev branch policy and organization workflow condition.
- **Prod does not require approval:** Check reviewer availability, the GitHub plan, and the prod environment rules.
- **Missing URL:** Add the project's derived URL variable to the selected environment.
- **Cloudflare error 10000:** Check the token, account, target list, expiration, and failing API operation.
- **Subdomain read fails:** Check the account-level Workers Metadata Read-only policy.
- **New target cannot deploy:** Create the target before you add it to the token.
- **Check name is absent:** Complete an initial build before you configure the required status check.

Do not solve a dev permission failure with account-wide edit access.
That permission would allow changes to prod targets in the same account.
