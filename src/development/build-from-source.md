# Build From Source

Most contributors only need `make build` and `make test`. The other targets exist for surface-specific work (WASM, Python, Native Node) and release-time staging.

::: info Glossary: staging
Staging places built artifacts in the package layout each surface expects — `packages/npm/dist/`, `packages/python/formulon/_wasm/`, and the Native Node addon directory. It is what makes `npm test`, `unittest`, and `node --test` reach the freshly built core.
:::

Clone the repository:

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
```

Native builds require CMake and a C++17 toolchain. WASM builds require the Emscripten SDK pinned in `tools/wasm/emsdk-version.txt`. The npm package requires Node 22 or newer. Install `brotli` to run the complete size check.

## Native debug build

```sh
make build
make test
```

This configures `build/` with CMake and runs the fast CTest suite. `make test` excludes `SLOW`, `BENCH`, and `TSAN` labels. `make test-slow` includes `SLOW` while still excluding `BENCH` and `TSAN`; `make test-all` runs every test enabled in the build configuration. Use this loop for most core changes.

## Release build

```sh
make release
```

Use the release build before measuring performance or shipping artifacts. Debug builds carry extra assertions that distort timings.

## WASM package

Requires the pinned [Emscripten](https://emscripten.org/) SDK and Node 22 or newer:

```sh
make wasm
make wasm-threads
make test-wasm
make npm-package
make npm-check-dts
make npm-test
make npm-pack
make size-check
```

`make wasm` builds the single-threaded `formulon.js` / `formulon.wasm` pair under `build-wasm/`. `make wasm-threads` builds the pthread `formulon_threads.js` / `formulon_threads.wasm` pair under `build-wasm-threads/`. `make test-wasm` runs smoke tests against both builds. `make npm-package` stages both builds, their entry shims, and `formulon.d.ts` into `packages/npm/dist/`; the default entry is `@libraz/formulon` and the pthread entry is `@libraz/formulon/threads`. `make npm-check-dts` checks the staged declaration against the source declaration, and `make npm-test` exercises both staged entries. `make size-check` enforces the [Size budgets](/development/size-budgets) for both WASM binaries.

## Python package

Requires CMake, Python 3.9+, setuptools, wheel, the pinned [Emscripten](https://emscripten.org/) SDK, and the `wasmtime` runtime. `make python-package` depends on the `wasm-capi` target, which builds the embedded `formulon_capi.wasm` via `emcmake`:

```sh
python3 -m venv .venv-python
. .venv-python/bin/activate
python -m pip install 'wasmtime>=49,<50' setuptools wheel
make PYTHON=python python-package python-test python-wheel
```

The wheel stages `formulon_capi.wasm` into `packages/python/formulon/_wasm/` and builds a `py3-none-any` package. `wasmtime` is required for local tests and supplies the platform-specific runtime at wheel install time. No native compiler is needed at install time.

## Native Node package

```sh
make NODE_NATIVE_BUILD_DIR=build-node-native node-test
```

This builds the addon, stages it into the package layout, and runs its N-API test suite via `node --test`. Use a separate directory so the native addon build does not change the Debug core configuration in `build/`. Prebuilt binaries are published per `(os, arch)` from CI; the local target is mostly for development.

## Oracle tooling

Oracle generation requires Excel and host-specific setup:

```sh
make oracle-setup
make oracle-gen
make oracle-verify
```

CI verification reads committed goldens and does not start Excel. See [Oracle contribution](/development/oracle-contribution) for the contributor flow.

::: tip Pick a minimal working set
A contributor who only changes the formula evaluator usually needs `make build && make test`. A contributor who changes the WASM packaging usually needs `make wasm && make npm-test && make size-check`. Choose the builds and tests required by the change; few changes need every target.
:::

## Read next

- [Test matrix](/development/test-matrix) — which test target catches which category.
- [Size budgets](/development/size-budgets) — the WASM ceiling enforced by `size-check`.
- [Release checklist](/development/release-checklist) — what runs before a release.
