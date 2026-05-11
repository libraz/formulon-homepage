# Development

This section is for contributors and maintainers. It now focuses on the few workflows people actually need: build the project, run the right tests, update oracle data, and understand where implementation details live.

::: tip Start with the workflow, not the architecture
Most contributors should start with [Build from source](/development/build-from-source) and [Test matrix](/development/test-matrix). Architecture details are useful after you know which surface or formula family you are changing.
:::

## Workflows

| Task | Page |
| --- | --- |
| Build locally | [Build from source](/development/build-from-source) |
| Run tests | [Test matrix](/development/test-matrix) |
| Add Excel oracle data | [Oracle contribution](/development/oracle-contribution) |

## Code map

| Area | Where to look |
| --- | --- |
| C++ calculation core | [C++ core](/development/core) |
| Runtime bindings | [Bindings](/development/bindings) |
| Internal shape | [Architecture](/development/architecture) |
| Browser package limits | [Size budgets](/development/size-budgets) |
| Release mechanics | [Release checklist](/development/release-checklist) |

Operational work for Formulon is mostly about reproducibility: package every surface from the same core revision, keep oracle data current, record accepted divergences, and verify runtime parity.
