# Install

Use the surface that matches where the workbook will run. Formulon 0.9 packages are alpha packages: pin exact versions in applications and expect API growth before the first stable release.

::: warning Pin versions
Use exact package versions for experiments and internal tooling. Do not float on `latest` while APIs and packaging are still pre-stable.
:::

## JavaScript / WebAssembly

```sh
yarn add @libraz/formulon@0.9.2
```

Use this for browsers, workers, and Node-based services that should run the WASM build. The package is ESM-only and requires Node 18+ when used in Node.

For browser hosting, configure cross-origin isolation when pthread workers are enabled:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Python

```sh
python -m pip install formulon==0.9.2
```

Use this for scripts, notebooks, and batch jobs. The wheel ships a standalone
Formulon C-ABI WASM module plus a pure-Python wrapper driven through
`wasmtime`; it does not require NumPy, Cython, or pybind11 at runtime.

## CLI

Download the platform binary from GitHub Releases when you need a standalone tool for `eval`, `recalc`, or workbook inspection workflows.

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon recalc input.xlsx -o output.xlsx
```

## From source

Clone the repository and build the surface you need:

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
make build
make test
```

Packaging commands live in [Build from source](/development/build-from-source).
