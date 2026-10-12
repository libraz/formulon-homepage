# Workbook Engine

This section explains how Formulon models, edits, recalculates, and preserves workbooks. The same flow applies to every host surface — what changes between surfaces is packaging, memory ownership, and error reporting.

<DiagramFlow steps="Open bytes → Workbook model → Mutate cells or structure → Dependency graph → Recalculate → Read values or save bytes" />

::: info Why "Workbook" is its own section
Runtimes describe *how* you invoke Formulon; the workbook section describes *what* the engine actually does once invoked. The split lets the runtime pages stay focused on host integration while the engine concepts live in one place.
:::

## Read next

- [Lifecycle](/workbook/lifecycle) — how bytes become a workbook model and back.
- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, function behavior.
- [Formula language](/workbook/language) — localized formula input, display, and calculation profiles.
- [Workbook operations](/workbook/operations) — sheets, cells, styles, metadata, structures.
- [Presentation and geometry](/workbook/presentation) — display text, themes, effective styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — visible rows and proposed-value checks.
- [Comments and images](/workbook/comments-images) — threaded discussions and anchored pictures.
- [Recalculation](/workbook/recalculation) — dirty cells, dependencies, iterative settings, partial recalc.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill behavior and shape-sensitive recalculation.
- [File formats](/workbook/file-formats) — OOXML, XLSB, and preservation boundaries.
- [PivotTables](/workbook/pivots) — build and inspect cache-backed summaries.
