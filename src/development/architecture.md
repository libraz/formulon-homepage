# Architecture

Formulon is organized around a single calculation core with thin packaging layers. Every host surface — WASM, Native Node, Python, CLI, MCP, `formulon-cell` — uses the same C++17 core through the C ABI.

::: info Glossary: C ABI layer
A flat C function interface that exposes the workbook model, evaluator, and IO to non-C++ hosts. It is the compatibility boundary; bindings call into it, but only the core implements it. See [Bindings](/development/bindings).
:::

::: info Glossary: workbook model
The in-memory representation of an opened workbook — sheets, cells, styles, defined names, tables, dependency graph, dirty set, profile binding, and the workbook-level engine state needed to recalculate. Bindings hold a handle to the model, never the underlying bytes after parsing.
:::

<DiagramLayers
  label="Layers from the host API down through the C ABI and binding layer to the C++17 workbook model, with the formula evaluator and file readers and writers beside it, and Oracle and parity tests verifying the whole."
  caption="Every host surface reaches the same C++17 core through the C ABI; bindings translate values and lifetimes, never calculation."
  :layers="[
  { title: 'Host', nodes: [{ label: 'Host API', note: 'JS · Python · CLI · MCP · cell UI', tone: 'alt' }] },
  { title: 'Boundary', nodes: [{ label: 'C ABI / binding layer', note: 'Lifetimes and value translation' }] },
  { title: 'Core', nodes: [{ label: 'C++17 workbook model', note: 'Sheets, cells, dependency graph' }] },
  { title: 'Evaluation & IO', nodes: [
    { label: 'Parser and evaluator', note: 'Function catalog, tree walker' },
    { label: 'File readers and writers', note: 'OOXML, XLSB, passthrough' }
  ] },
  { title: 'Verification', nodes: [{ label: 'Oracle and parity tests', note: 'Excel values, cross-surface agreement' }] }
]" />

## What lives where

| Layer | Owns |
| --- | --- |
| Host API | Language-specific surface (JS / Python / CLI / MCP tools / cell UI) |
| C ABI / binding | Lifetime management, host value ↔ engine value translation |
| Workbook model | Sheets, cells, styles, dependency graph, dirty state, profile |
| Parser / evaluator | Function catalog, tree-walker evaluator, error propagation |
| File format layer | OOXML, XLSB readers and writers, passthrough preservation |
| Oracle / parity tests | Captured Excel values, cross-surface agreement |

The core owns workbook state, formula semantics, file parsing, dependency tracking, and recalculation. Bindings should translate host values and lifetime management without changing calculation behavior.

The tree-walker is the only evaluator in release, developer, and test builds. All host surfaces use it through the same core.

## Why the split

- **Shared semantics**: the shared core provides the same calculation semantics when profile, input, clock, and RNG configuration match.
- **Embedding**: the core has no Node, Python, or browser assumptions, so the same C++ source can be built for all three.
- **Testing**: oracle tests verify calculation behavior in the shared engine; package tests separately verify binding translation and lifetime management.

## Read next

- [C++ core](/development/core) — internal conventions of the calculation core.
- [Bindings](/development/bindings) — responsibilities and non-responsibilities.
- [Build from source](/development/build-from-source) — how the artifacts are produced.
