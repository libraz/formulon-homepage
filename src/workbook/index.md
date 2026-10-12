# Workbook Engine

This section explains how Formulon models, edits, recalculates, and saves workbooks. The runtime pages cover how to call the engine from each host; these pages cover what the engine does once called. The flow is the same on every host. Packaging, memory ownership, and error reporting are what differ.

<DiagramFlow steps="Open bytes → Workbook model → Mutate cells or structure → Dependency graph → Recalculate → Read values or save bytes" />

## Read next

- [Lifecycle](/workbook/lifecycle) — how bytes become a workbook model and back.
- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, function behavior.
- [Formula language](/workbook/language) — localized formula input, display, and calculation profiles.
- [Workbook operations](/workbook/operations) — sheets, cells, styles, metadata, structures.
- [Presentation and geometry](/workbook/presentation) — display text, themes, effective styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — visible rows and proposed-value checks.
- [Conditional formats](/workbook/conditional-formats) — rules, differential formats, and evaluation for rendering.
- [Comments and images](/workbook/comments-images) — threaded discussions and anchored pictures.
- [Recalculation](/workbook/recalculation) — dirty cells, dependencies, iterative settings, partial recalc.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill behavior and shape-sensitive recalculation.
- [File formats](/workbook/file-formats) — OOXML, XLSB, and preservation boundaries.
- [PivotTables](/workbook/pivots) — build and inspect cache-backed summaries.
