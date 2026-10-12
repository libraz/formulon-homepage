# Install

Use the surface that matches where the workbook will run. Formulon packages are pre-1.0: pin exact versions in applications and expect API growth before the first stable release.

::: warning Pin versions
Use exact package versions for experiments and internal tooling. Do not float on `latest` while APIs and packaging are still pre-stable.
:::

The package commands below pin Formulon 0.15.1 and formulon-cell 0.9.0, which include the APIs described here. To build the same releases yourself, follow [Build from source](/development/build-from-source). The cell packages have their own release cycle; [Language switching](/cell/language-switching) covers their runtime locale and calculation-profile controls.

## JavaScript / WebAssembly

```sh
yarn add @libraz/formulon@0.15.1
```

Use this for browsers, workers, and Node-based services that should run the WASM build. The package is ESM-only and requires Node 22 or newer when used in Node.

The default WASM entry and the standard `formulon-cell` loader run serially without cross-origin isolation. The parallel build at `@libraz/formulon/threads` requires the following headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Python

```sh
python -m pip install formulon==0.15.1
```

Use this for scripts, notebooks, and batch jobs. The wheel targets Python 3.9 and later and ships a standalone Formulon C-ABI WASM module plus a pure-Python wrapper driven through `wasmtime`; it does not require NumPy, Cython, or pybind11 at runtime.

## CLI

Download the platform binary from GitHub Releases when you need a standalone tool for `eval`, `recalc`, or workbook inspection workflows.

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon recalc input.xlsx -o output.xlsx
```

The CLI accepts `--profile` to select calculation behavior and `--now` to fix the evaluation clock. To build it from the same source as these docs, follow the steps below.

## formulon-cell

```sh
yarn add @libraz/formulon-cell@0.9.0 @libraz/formulon-cell-vue@0.9.0
```

Install `@libraz/formulon-cell-vue` when using the Vue adapter. The core package is shared by the framework adapters.

## From source

Clone the repository at the revision used by the current docs and build the surface you need:

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
git checkout v0.15.1
make build
make test
```

`make build` produces `build/bin/formulon_cli`. This revision also includes the current workbook APIs described here; build and stage the matching binding when using them from JavaScript or Python.

Packaging commands live in [Build from source](/development/build-from-source).
