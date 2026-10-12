# Install

Use the surface that matches where the workbook will run.

::: warning Pin versions
Formulon is pre-1.0, and APIs and packaging can still change between releases. Install exact versions, including for experiments and internal tooling, rather than floating on `latest`.
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

Use the standalone binary for `eval`, `recalc`, and workbook inspection from a shell or CI. [GitHub Releases](https://github.com/libraz/formulon/releases) carries one archive per platform (`darwin-arm64`, `linux-x64`, `linux-arm64`), each with a `.sha256` checksum file:

```sh
curl -LO https://github.com/libraz/formulon/releases/download/v0.15.1/formulon-0.15.1-linux-x64.tar.gz
tar -xzf formulon-0.15.1-linux-x64.tar.gz
export PATH="$PWD/formulon-0.15.1-linux-x64:$PATH"

formulon --version
formulon eval '=SUM(1,2,3)'
formulon recalc input.xlsx -o output.xlsx
```

Every subcommand accepts `--profile` to select calculation behavior and `--now` to fix the evaluation clock.

## formulon-cell

```sh
yarn add @libraz/formulon-cell@0.9.0 @libraz/formulon-cell-vue@0.9.0
```

`@libraz/formulon-cell` is the framework-independent core. Add `@libraz/formulon-cell-vue` or `@libraz/formulon-cell-react` for the matching adapter; see [formulon-cell install](/cell/install).

## From source

Check out the tag these docs describe and build:

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
git checkout v0.15.1
make build
make test
```

`make build` produces a debug CLI at `build/bin/formulon_cli`. The WASM, Python and Native Node bindings have their own build targets; see [Build from source](/development/build-from-source), and [Native Node integration](/runtimes/node-native) for staging the `.node` addon.
