# Release Checklist

A green per-package build is not enough. The release is healthy only when every surface agrees on workbook behavior and the compatibility claims still line up with reality.

::: info Glossary: same-revision release
A release where every shipped artifact — WASM, Native Node, Python wheel, CLI binaries, MCP server, `formulon-cell` — was built from the same Git revision of the core. Avoids the subtle bug where one surface ships a fix and another does not.
:::

## Before a release

- [ ] Run core tests (`make test-all`).
- [ ] Run oracle tests for available profiles (`make oracle-verify`).
- [ ] Verify WASM size budgets (`make size-check`).
- [ ] Build JavaScript, Python, CLI, and native artifacts from the same revision.
- [ ] Smoke-test each package surface.
- [ ] Run `make parity-test` after staging available package surfaces.
- [ ] Run `RegistryCatalog.CoverageReport` and update [Formula coverage](/compatibility/formula-coverage) if it changed.
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

::: warning Do not treat a green package build as enough
The release is only healthy if the surfaces agree on workbook behavior. A WASM build that recalcs differently from Python is a worse user experience than either build being slightly wrong — at least when they agree, applications can be debugged with one mental model.
:::

## After release

- [ ] Tag the release in Git and push.
- [ ] Publish artifacts (npm, PyPI, GitHub Releases).
- [ ] Update the `docsVersion` in the homepage repo if the docs site tracks it.
- [ ] Watch for incoming compatibility issues and route them to the right oracle / profile.

## Read next

- [Test matrix](/development/test-matrix) — what each test target covers.
- [Size budgets](/development/size-budgets) — the WASM ceiling.
- [Compatibility model](/compatibility/model) — what the claims have to back up.
