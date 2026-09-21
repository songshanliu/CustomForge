# Releasing CustomForge

This repository publishes stable npm releases from signed or annotated Git tags whose names exactly match `v<package version>`

## One-time configuration

1. Create an `npm` environment in the GitHub repository and apply any required reviewers
2. Configure npm Trusted Publishing for the GitHub repository, workflow file `.github/workflows/release.yml`, and `npm` environment
3. If Trusted Publishing is unavailable, add an npm automation token as the `NPM_TOKEN` environment secret
4. Keep branch protection and the `CI / release-check` job required on `main`

The release workflow requests only repository read access and an OIDC identity token. It publishes with npm provenance and does not run package lifecycle scripts during the final `npm publish`, because the same tagged source has already passed `pnpm release:check`

## Release gate

From a clean checkout with Node.js 22+ and pnpm 11+, run

```powershell
pnpm install --frozen-lockfile
pnpm release:check
```

The gate verifies release metadata, checks TypeScript, runs unit tests, rebuilds and inspects the package, creates the local tarball, installs that tarball into both independent consumer projects, builds both consumers, and executes the API contract consumer in headless Chrome

The generated archive for version `0.1.0` is `customforge-0.1.0.tgz`

## Publish a release

1. Move completed changelog entries from `Unreleased` into a dated version section
2. Set the same stable SemVer in `package.json` and both local consumer dependency paths
3. Run the complete release gate and review the packed file list and unpacked size
4. Commit the release preparation and merge it to `main`
5. Create an annotated tag such as `v0.1.0` on that commit and push the tag
6. Confirm the `Release npm package` workflow completed and the npm page shows the expected version, provenance, files, README, and `latest` dist-tag
7. Install the registry version into a clean external application and repeat the primary editor workflow before announcing the release

The workflow rejects prerelease versions, explicit non-latest publish tags, mismatched Git tags, missing changelog entries, stale consumer tarball paths, and checked-in consumer lockfiles

## Failed releases

Do not move an existing tag to another commit and do not overwrite a published npm version. Fix the issue, create a new patch version, update the changelog, and publish a new tag. Use npm deprecation for a bad version unless removal is both permitted by npm policy and strictly necessary
