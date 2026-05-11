# Workbook Engine

This section explains how Formulon models, edits, recalculates, and preserves workbooks. The same flow applies to every host surface — what changes between surfaces is packaging, memory ownership, and error reporting.

```mermaid
flowchart LR
  A[Open bytes] --> B[Workbook model]
  B --> C[Mutate cells or structure]
  C --> D[Dependency graph]
  D --> E[Recalculate]
  E --> F[Read values or save bytes]
```

::: info Why "Workbook" is its own section
Runtimes describe *how* you invoke Formulon; the workbook section describes *what* the engine actually does once invoked. The split lets the runtime pages stay focused on host integration while the engine concepts live in one place.
:::

## Read next

- [Lifecycle](/workbook/lifecycle) — how bytes become a workbook model and back.
- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, function behavior.
- [Workbook operations](/workbook/operations) — sheets, cells, styles, metadata, structures.
- [Recalculation](/workbook/recalculation) — dirty cells, dependencies, iterative settings, partial recalc.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill behavior and shape-sensitive recalculation.
- [File formats](/workbook/file-formats) — OOXML, XLSB, and preservation boundaries.
