# Release Checklist

A successful package build is not enough. The release is healthy only when every surface agrees on workbook behavior and the compatibility claims still line up with reality.

::: info Glossary: same-revision release
A core release whose WASM, Native Node, Python wheel, and CLI binaries are built from the same Git revision. This keeps a fix consistent across the core bindings. MCP and `formulon-cell` are separate packages; verify their supported engine dependencies before upgrading them.
:::

## Before a release

- [ ] Run core tests (`make test-all`).
- [ ] Run primary Oracle verification (`make oracle-verify`). If a supported variant changed, also configure `FORMULON_ORACLE_VARIANTS=ON`, build `formulon_oracle_variant_tests` and `formulon_workbook_oracle_variant_tests`, and run `ctest -L VARIANT`.
- [ ] Verify WASM size budgets (`make size-check`).
- [ ] Build JavaScript, Python, CLI, and native artifacts from the same revision.
- [ ] Smoke-test each package surface.
- [ ] Run `make parity-test` after staging available package surfaces.
- [ ] Run `RegistryCatalog.CoverageReport` (`ctest -R RegistryCatalog.CoverageReport -V` from the build directory — diagnostic-only, always passes, reads the coverage percentage from stdout) and update [Formula coverage](/compatibility/formula-coverage) if it changed.
- [ ] Check [Compatibility](/compatibility/) for stale status claims.
- [ ] Update changelog and docs version.

## Why each step

| Step | Catches |
| --- | --- |
| `make test-all` | Engine-internal regressions |
| `make oracle-verify` | Drift between Formulon and captured Excel values |
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

- [ ] Tag the release (`git tag vX.Y.Z && git push origin vX.Y.Z`). The tag triggers `release.yml`, which publishes npm and PyPI through trusted publishing and creates the GitHub Release and CLI assets with GitHub workflow credentials.
- [ ] Check the separate `prebuild.yml` workflow for the Native Node matrix and its `release-bundle` job on the same tag. Verify the uploaded native artifacts separately.
- [ ] Update the `docsVersion` in the homepage repo if the docs site tracks it. After npm publication, update the root demo dependency, remove the global `@libraz/formulon` resolution, and regenerate the lockfile. Verify the displayed runtime versions. Keep `formulon-cell` on its supported engine dependency until its binding adapter supports the new accessor results.
- [ ] Watch for incoming compatibility issues and route them to the right oracle / profile.

<DiagramFlow steps="Work on develop → Open PR to main → CI passes → Merge → Push vX.Y.Z tag → release.yml + prebuild.yml → Verify artifacts" />

<DiagramLayers :layers="[
  { title: 'release.yml (tag-triggered)', nodes: ['publish-npm', 'build-cli', 'python-wheel', 'publish-pypi', 'attach-cli'] },
  { title: 'prebuild.yml (same tag)', nodes: ['Native Node matrix', 'release-bundle'] },
  { title: 'Result', nodes: ['npm + PyPI + CLI binaries + GitHub Release + Native Node artifacts — verified'] }
]" />

## Read next

- [Test matrix](/development/test-matrix) — what each test target covers.
- [Size budgets](/development/size-budgets) — the WASM ceiling.
- [Compatibility model](/compatibility/model) — what the claims have to back up.
