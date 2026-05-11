# Build From Source

Most contributors only need `make build` and `make test`. The other targets exist for surface-specific work (WASM, Python, Native Node) and release-time staging.

::: info Glossary: staging
Copying built artifacts into the package layout each surface expects — `packages/npm/dist/`, `packages/python/formulon/_wasm/`, the Native Node addon directory. Staging is what makes `npm test` / `pytest` / `node -e '…'` reach the freshly built core.
:::

Clone the repository:

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
```

## Native debug build

```sh
make build
make test
```

This configures `build/` with CMake and runs the fast CTest suite, excluding `SLOW` / `LOAD` labels. Use this loop for almost all core changes.

## Release build

```sh
make release
```

Use the release build before measuring performance or shipping artifacts. Debug builds carry extra assertions that distort timings.

## WASM package

Requires [Emscripten](https://emscripten.org/):

```sh
make wasm
make test-wasm
make npm-package
make npm-test
make npm-pack
make size-check
```

`make npm-package` stages `formulon.js`, `formulon.wasm`, and `formulon.d.ts` into `packages/npm/dist/`. `make size-check` is what enforces the [Size budgets](/development/size-budgets) — run it before any change that could pull in new code.

## Python package

Requires CMake, Python 3.9+, setuptools, and wheel:

```sh
make python-package
make python-test
make python-wheel
```

The wheel stages `formulon_capi.wasm` into `packages/python/formulon/_wasm/` and builds a `py3-none-any` package; `wasmtime` supplies the platform-specific runtime wheel at install time. No native compiler is needed at install time.

## Native Node package

```sh
make node-native
make node-package
make node-test
```

This builds and stages the N-API addon. Prebuilt binaries are published per `(os, arch)` from CI; the local target is mostly for development.

## Oracle tooling

Oracle generation requires Excel and host-specific setup:

```sh
make oracle-setup
make oracle-gen
make oracle-verify
```

CI verification reads committed goldens and does not start Excel. See [Oracle contribution](/development/oracle-contribution) for the contributor flow.

::: tip Pick a minimal working set
A contributor who only changes the formula evaluator usually needs `make build && make test`. A contributor who changes the WASM packaging usually needs `make wasm && make npm-test && make size-check`. Few changes need every target.
:::

## Read next

- [Test matrix](/development/test-matrix) — which test target catches which category.
- [Size budgets](/development/size-budgets) — the WASM ceiling enforced by `size-check`.
- [Release checklist](/development/release-checklist) — what runs before a release.
