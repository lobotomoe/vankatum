# Releasing

How a new version of `vankatum` reaches npm. Publishing uses **OIDC trusted
publishing** — GitHub Actions proves its identity to npm directly, so there is no
npm token stored anywhere in the repo or in CI secrets.

## One-time bootstrap (first publish only)

npm cannot register a trusted publisher for a package that does not exist yet, so
`v0.1.0` is published once by hand; every later release is fully automated.

1. Log in locally (npm account with 2FA):
   ```sh
   npm login
   ```
2. Publish the first version **without** provenance — provenance can only be
   generated from CI/OIDC, so a local publish must opt out for this one time:
   ```sh
   npm publish --provenance=false
   ```
   `access: public` and the version come from `package.json`; `prepublishOnly`
   (typecheck + lint + tests) and `prepack` (clean build) run automatically.
3. On npmjs.com open **the package** → `Settings` → `Trusted Publisher` and add:
   - **Publisher:** GitHub Actions
   - **Organization or user:** `lobotomoe`
   - **Repository:** `vankatum`
   - **Workflow filename:** `publish.yml`
   - **Environment:** leave empty (see hardening note below)

   These must match [`.github/workflows/publish.yml`](../.github/workflows/publish.yml)
   and the `repository` field in `package.json` exactly.

After this, delete any local/legacy npm tokens — they are no longer needed.

## Every subsequent release

1. Bump the version and create the tag in one step (this also writes the commit):
   ```sh
   npm version patch   # or minor / major
   ```
2. Push the commit and the tag:
   ```sh
   git push --follow-tags
   ```

The `v*` tag triggers two independent workflows:

- [`publish.yml`](../.github/workflows/publish.yml) — publishes to npm via trusted
  publishing, with automatic provenance.
- [`release.yml`](../.github/workflows/release.yml) — regenerates the hyphenation
  pattern artifacts and attaches them to the GitHub Release.

They are deliberately decoupled: the npm package does not depend on the pattern
artifacts, so neither blocks the other.

## Verifying a release

```sh
npm view vankatum version           # registry has the new version
npm view vankatum dist.attestations  # provenance is attached
```

The package page on npmjs.com shows a green “Built and signed” provenance badge
linking back to the exact workflow run and commit.

## Optional hardening — environment protection

To require a manual approval before any npm publish, create a GitHub
[environment](https://docs.github.com/en/actions/deployment/targeting-different-environments)
(e.g. `npm`) with required reviewers, add `environment: npm` to the `publish` job,
and set the same **Environment** name in the npm trusted-publisher config. The
OIDC claim then carries the environment and npm rejects any run that skips it.
Both sides must agree, so configure them together.
