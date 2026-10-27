# Release Checklist

A successful package build is not enough. The release is healthy only when every surface agrees on workbook behavior and the compatibility claims still line up with reality.

::: info Glossary: same-revision release
A core release whose WASM, Native Node, Python wheel, and CLI binaries are built from the same Git revision. This keeps a fix consistent across the core bindings. MCP and `formulon-cell` are separate packages; verify their supported engine dependencies before upgrading them.
:::

## Before a release

- [ ] Run core tests (`make test-all`).
- [ ] Run primary Oracle verification (`make oracle-verify`). If a supported variant changed, also configure `FORMULON_ORACLE_VARIANTS=ON`, build `formulon_oracle_variant_tests` and `formulon_workbook_oracle_variant_tests`, and run `ctest -L VARIANT`.
- [ ] Check the divergence registry (`tools/oracle/.venv/bin/python tools/oracle/divergence_check.py --strict` must exit 0). The release bar is zero oracle failures; read the per-cause skip tally it prints before quoting a pass rate.
- [ ] Require active workbook captures (`tools/oracle/.venv/bin/python tools/oracle/workbook_closure_check.py --require-active`). The ordinary closure check allows pending captures, so it is not the release gate.
- [ ] Verify WASM size budgets (`make size-check`).
- [ ] Build JavaScript, Python, CLI, and native artifacts from the same revision.
- [ ] Smoke-test each package surface.
- [ ] Run `make parity-test` after staging available package surfaces.
- [ ] Refresh the homepage demo snapshots with `yarn demos:prepare` after staging the current core WASM and cell packages from their sibling checkouts; review `vendor/manifest.json` source commits, source-diff SHA-256 values, and archive SHA-256 values, then run `yarn check:demos` and a normal homepage build without sibling checkouts.
- [ ] Run `RegistryCatalog.CoverageReport` (`ctest -R RegistryCatalog.CoverageReport -V` from the build directory — diagnostic-only, always passes, reads the coverage percentage from stdout) and update [Formula coverage](/compatibility/formula-coverage) if it changed.
- [ ] Check [Compatibility](/compatibility/) for stale status claims.
- [ ] Update changelog and docs version.
- [ ] After updating `docsVersion`, regenerate API tables from that core commit with `yarn gen:api --ref <core-commit>` and run `yarn check:api`. Keep package dependencies on published versions during preparation.

## Why each step

| Step | Catches |
| --- | --- |
| `make test-all` | Engine-internal regressions |
| `make oracle-verify` | Drift between Formulon and captured Excel values |
| `divergence_check.py --strict` | Accepted divergences resting on an unverified or stale Excel observation |
| `make size-check` | WASM bloat that would slow page loads |
| Same-revision build | Cross-surface drift caused by partial rebuilds |
| Smoke-test each surface | Packaging or binding-only regressions |
| `make parity-test` | Surfaces that compute different values for the same input |
| `RegistryCatalog.CoverageReport` | Stale function-count claims in docs |
| Compatibility audit | "Excel-compatible" claims that no longer hold |
| Changelog and docs | User-facing surprises after upgrade |

::: warning Package builds do not prove cross-surface agreement
Run the parity check and binding smoke tests before release. They cover agreement between the available channels and host-side translation and lifetime behavior.
:::

## Publish and verify

- [ ] After develop CI passes, fast-forward main and wait for main CI to pass. Create an annotated tag (`git tag -a vX.Y.Z -m "Release vX.Y.Z"`), then push it with `git push origin vX.Y.Z`. The tag triggers `release.yml`, which publishes npm and PyPI through trusted publishing and creates the GitHub Release and CLI assets with GitHub workflow credentials.
- [ ] Check the separate `prebuild.yml` workflow on the same tag. Its `release-bundle` job collects the prebuilt addons into a `formulon-native-bundle` artifact; publishing `@libraz/formulon-native` to npm is a manual step.
- [ ] Once the tag exists, rebase the released C ABI baseline onto it (`python3 tools/dev/gen_c_abi_baseline.py vX.Y.Z`). Later ABI changes are then checked against this release.
- [ ] Update the homepage's `docsVersion` to the documented source version. Verify unreleased features with the ignored local snapshots (`yarn test:local` and `yarn build:local`). After the core, `formulon-cell`, and `formulon-cell-vue` packages are published, update the registry dependency pins, regenerate the lockfile, and rerun tests and the build without local aliases. Confirm the displayed runtime versions and the language-switching demo against the published packages before deploying.
- [ ] Watch for incoming compatibility issues and route them to the right oracle / profile.

<DiagramFlow
  label="Release order: work on develop, pass develop CI, fast-forward main, pass main CI, push an annotated tag, let release.yml and prebuild.yml run, then verify the artifacts."
  caption="The tag is pushed last, after develop and main CI have both passed."
  :steps="[
  { label: 'Work on develop', note: 'Run the pre-release checklist' },
  { label: 'Develop CI passes', note: 'Required before main moves' },
  { label: 'Fast-forward main', note: 'Promote develop to main' },
  { label: 'Main CI passes', note: 'Gate before tagging' },
  { label: 'Push annotated tag', note: 'git tag -a vX.Y.Z' },
  { label: 'release.yml + prebuild.yml', note: 'Both start from the same tag' },
  { label: 'Verify artifacts', note: 'Packages, Release, CLI, addons' }
]" />

<DiagramLayers
  label="The tag triggers release.yml, which publishes npm and PyPI and builds and attaches the CLI, and prebuild.yml, which bundles the Native Node prebuilds. The Native Node bundle is published to npm by hand."
  caption="One tag starts both workflows, but publishing the Native Node package to npm remains a manual step."
  :layers="[
  { title: 'release.yml (tag-triggered)', nodes: [
    { label: 'publish-npm', note: 'Trusted publishing' },
    { label: 'build-cli', note: 'Builds CLI binaries' },
    { label: 'python-wheel', note: 'Builds Python wheels' },
    { label: 'publish-pypi', note: 'Trusted publishing' },
    { label: 'attach-cli', note: 'Adds CLI to the Release' }
  ] },
  { title: 'prebuild.yml (same tag)', nodes: [
    { label: 'Native Node matrix', note: 'Prebuilt addons per platform' },
    { label: 'release-bundle', note: 'formulon-native-bundle artifact' }
  ] },
  { title: 'Result', nodes: [
    { label: 'npm and PyPI packages', note: 'Published by release.yml' },
    { label: 'GitHub Release', note: 'CLI binaries attached' },
    { label: 'Native Node bundle', note: 'npm publish is manual', tone: 'alt' }
  ] }
]" />

## Read next

- [Test matrix](/development/test-matrix) — what each test target covers.
- [Size budgets](/development/size-budgets) — the WASM ceiling.
- [Compatibility model](/compatibility/model) — what the claims have to back up.
