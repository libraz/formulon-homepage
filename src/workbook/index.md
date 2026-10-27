# Workbook Engine

This section explains how Formulon models, edits, recalculates, and saves workbooks. The runtime pages cover how to call the engine from each host; these pages cover what the engine does once called. The flow is the same on every host. Packaging, memory ownership, and error reporting are what differ.

<DiagramFlow :steps="[
  { label: 'Open bytes', note: 'XLSX or XLSB' },
  { label: 'Workbook model', note: 'sheets · cells · styles · names' },
  { label: 'Edit', note: 'cells or structure' },
  { label: 'Dependency graph', note: 'reference edges between cells' },
  { label: 'Recalculate', note: 'evaluates the dirty cells' },
  { label: 'Read or save', note: 'cached values, or bytes' }
]" label="Workbook flow: open bytes, build the model, edit, update the dependency graph, recalculate, then read values or save bytes" caption="The flow is the same on every host; only packaging, memory ownership and error reporting differ." />

## Read next

If the distinction between a formula and its cached value is new, start with [Basic concepts](/start/concepts). Then follow the lifecycle through calculation before exploring individual workbook features.

- [Lifecycle](/workbook/lifecycle) — how bytes become a workbook model and back.
- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, function behavior.
- [Formula language](/workbook/language) — localized formula input, display, and calculation profiles.
- [Recalculation](/workbook/recalculation) — dirty cells, dependencies, iterative settings, partial recalc.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill behavior and shape-sensitive recalculation.
- [Workbook operations](/workbook/operations) — sheets, cells, styles, metadata, structures.
- [Presentation and geometry](/workbook/presentation) — display text, themes, effective styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — visible rows and proposed-value checks.
- [Conditional formats](/workbook/conditional-formats) — rules, differential formats, and evaluation for rendering.
- [Comments and images](/workbook/comments-images) — threaded discussions and anchored pictures.
- [Charts](/workbook/charts) — read, create, and edit charts, and resolve their series against cell values.
- [File formats](/workbook/file-formats) — OOXML, XLSB, and preservation boundaries.
- [PivotTables](/workbook/pivots) — build and inspect cache-backed summaries.
