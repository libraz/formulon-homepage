# Test Matrix

The test surface is broader than a single `make test` because Formulon ships multiple packages from one source tree. The core, Oracle, packaging, and cross-surface agreement checks catch different categories of regression.

::: info Glossary: CTest labels
CTest groups tests with text labels such as `SLOW`, `BENCH`, `TSAN`, and `VARIANT`. Targets can include or exclude labels, so a fast pre-commit run can skip slow or diagnostic tests while CI still runs them.
:::

<DiagramLayers :layers="[
  { title: 'Core', nodes: [{ label: 'make test', note: 'excludes SLOW / BENCH / TSAN' }, { label: 'make test-all', note: 'all enabled tests' }] },
  { title: 'Oracle', nodes: [{ label: 'make oracle-verify', note: 'vs committed goldens' }, { label: 'VARIANT tests', note: 'FORMULON_ORACLE_VARIANTS=ON' }] },
  { title: 'Packaging', nodes: [{ label: 'WASM', note: 'wasm / test-wasm / npm-test' }, { label: 'Python', note: 'python-test' }, { label: 'Native Node', note: 'node-test' }, { label: 'CLI', note: 'tests/cli CTest target' }] },
  { title: 'Parity', nodes: [{ label: 'make parity-test', note: 'cross-surface agreement' }] }
]" />

## Core tests

```sh
make build
make test
make test-slow
make test-all
```

`make test` excludes `SLOW`, `BENCH`, and `TSAN` labels. `make test-slow` includes `SLOW` while still excluding `BENCH` and `TSAN`. `make test-all` runs every test enabled in the build configuration. Run `make test` before every commit and `make test-all` before opening a PR that touches the core.

## Oracle tests

```sh
make oracle-verify
```

Oracle verification compares Formulon output with committed goldens generated from Excel. It does not launch Excel and is safe for CI.

Variant oracle tests are opt-in:

```sh
cmake -B build-variants -DCMAKE_BUILD_TYPE=Debug -DFORMULON_ORACLE_VARIANTS=ON
cmake --build build-variants --target formulon_oracle_variant_tests formulon_workbook_oracle_variant_tests --parallel
ctest --test-dir build-variants -L VARIANT --output-on-failure
```

Only provenance-approved variant directories are included. Enabling the option does not activate every captured target. Use this check when investigating profile-specific differences or before adding a supported profile.

## Packaging smoke tests

| Surface | Commands |
| --- | --- |
| WASM | `make wasm`, `make test-wasm`, `make npm-test` |
| Python | `make python-test` |
| Native Node | `make node-test` |
| CLI | CTest target under `tests/cli` |

These verify each binding's `load → mutate → recalc → save` loop, including host-side value translation and resource lifetime behavior, after a core change.

## Cross-surface parity

```sh
make parity-test
```

The runner compares the CLI, npm WASM, and Python channels that are available locally. Unavailable channels are skipped. At least two active channels are required; otherwise the runner exits with skip code 77 and `make` reports a nonzero result. It fails on disagreements, evaluation failures, or incorrect fixture expectations. Native Node, the pthread npm entry, MCP, and the cell UI require separate tests.

::: tip Parity and Oracle
Parity checks whether the available runtime channels agree with each other. Oracle checks whether the core agrees with Excel. Both signals are needed before a release.
:::

## Diagnostics

| Command | Purpose |
| --- | --- |
| `ctest -R RegistryCatalog.CoverageReport -V --output-on-failure` (run from the build directory, after `make build`) | Runtime function-registration status against the canonical catalog |
| `make behavior-status` | Status of the fine-grained behavior catalog |
| `make coverage` | Local coverage diagnostic |
| `make mutation` | Local mutation-testing diagnostic |

`RegistryCatalog.CoverageReport` is a diagnostic-only gtest case — it always passes and prints its coverage percentage to stdout, which only surfaces with `ctest -V`. It is not a gate; treat it as a way to read the current number, not a pass/fail check.

## Extended diagnostics

| Target | Purpose |
| --- | --- |
| `make ironcalc-verify` | Verify the secondary IronCalc oracle fixtures |
| `make fuzz` / `make fuzz-long` | Run the parser, evaluator, file-format, and print-settings fuzz harnesses |
| `bash tools/ci/run_tsan.sh` | Run the thread-sanitizer suite used by CI |

## Read next

- [Build from source](/development/build-from-source) — what the test targets compile against.
- [Oracle contribution](/development/oracle-contribution) — what feeds `oracle-verify`.
- [Release checklist](/development/release-checklist) — when each test runs in the release flow.
