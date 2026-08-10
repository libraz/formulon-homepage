# Architecture

Formulon is organized around a single calculation core with thin packaging layers. Every host surface — WASM, Native Node, Python, CLI, MCP, `formulon-cell` — sits on top of the same C++17 core through the C ABI.

::: info Glossary: C ABI layer
A flat C function interface that exposes the workbook model, evaluator, and IO to non-C++ hosts. It is the only stable boundary; bindings call into it, but only the core implements it. See [Bindings](/development/bindings).
:::

::: info Glossary: workbook model
The in-memory representation of an opened workbook — sheets, cells, styles, defined names, tables, dependency graph, dirty set, profile binding, and the workbook-level engine state needed to recalculate. Bindings hold a handle to the model, never the underlying bytes after parsing.
:::

<DiagramLayers :layers="[
  { title: 'Host', nodes: ['Host API (JS / Python / CLI / MCP / cell UI)'] },
  { title: 'Boundary', nodes: ['C ABI / binding layer'] },
  { title: 'Core', nodes: ['C++17 workbook model'] },
  { title: 'Evaluation & IO', nodes: ['Formula parser and tree-walker evaluator', 'OOXML / XLSB readers and writers'] },
  { title: 'Verification', nodes: ['Oracle tests / optional VM parity'] }
]" />

## What lives where

| Layer | Owns |
| --- | --- |
| Host API | Language-specific surface (JS / Python / CLI / MCP tools / cell UI) |
| C ABI / binding | Lifetime management, host value ↔ engine value translation |
| Workbook model | Sheets, cells, styles, dependency graph, dirty state, profile |
| Parser / evaluator | Function catalog, production tree-walker, error propagation; optional experimental bytecode VM in developer/test builds |
| File format layer | OOXML, XLSB readers and writers, passthrough preservation |
| Oracle / parity tests | Captured Excel values, cross-surface agreement |

The core owns workbook state, formula semantics, file parsing, dependency tracking, and recalculation. Bindings should translate host values and lifetime management without changing calculation behavior.

Release CLI, WASM, and binding binaries use the tree-walker and do not carry the experimental bytecode compiler, optimizer, or VM. Developer and test builds may compile it with `FORMULON_BUILD_VM=ON`; parity comparison is enabled only by an explicit `FORMULON_VM_PARITY_CHECK=ON` build.

## Why the split

- **Determinism**: a single calculation source means all surfaces produce the same values on the same profile.
- **Embedding**: the core has no Node, Python, or browser assumptions, so the same binary serves all three.
- **Testing**: oracle data is compared against the engine, not against per-binding logic.

## Read next

- [C++ core](/development/core) — internal conventions of the calculation core.
- [Bindings](/development/bindings) — responsibilities and non-responsibilities.
- [Build from source](/development/build-from-source) — how the artifacts are produced.
