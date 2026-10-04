---
title: Demos
description: Every interactive demo on the Formulon docs site, grouped by what you can try.
---

# Demos

Each demo runs the real engine in your browser; nothing is sent to a server. This page only links to them, so it stays light. Open the page that hosts a demo to read the surrounding explanation.

## Formulas and recalculation

- [Evaluate a formula](/start/evaluate): type a formula and see the engine's result, its value kind, and how errors such as `#DIV/0!` come back as values.
- [Recalculate a workbook](/start/recalculate): load an `.xlsx` or generate a sample, recalculate it, and download the saved bytes. The same demo appears in [Browser workbook upload](/scenarios/browser-upload).
- [Dependency tracing](/workbook/recalculation): select a cell in a formula chain and see its precedents and dependents, with a depth control.
- [Iterative calculation](/workbook/recalculation): solve a circular reference and watch the residual curve change as you adjust the tolerance.

## Workbook features

- [Dynamic arrays](/workbook/dynamic-arrays): preview the spill shape of an array formula, commit it to a sheet, and trigger a `#SPILL!` case.
- [PivotTables](/workbook/pivots): configure a pivot table and inspect the cells the engine projects.
- [Inserting and deleting rows and columns](/workbook/operations): edit the structure and compare formulas before and after, including references that collapse to `#REF!`.
- [XLSX and XLSB round trip](/workbook/file-formats): write one workbook into both containers and read each back.

## Compatibility

- [Function lookup](/compatibility/formula-coverage): search the function catalog read from the running engine, with arity and implementation status.
- [Error model](/compatibility/errors): compare a formula error value with a host failure from loading invalid bytes.

## formulon-cell UI

- [Full spreadsheet demo](/cell/demo): edit a seeded workbook, open menus and dialogs, switch themes and platform UI, and change which controls are visible.
- [Read-only report viewer](/cell/embedding): a fixed viewport that allows only selection and copy.
- [Fixed-input form](/cell/embedding): a sheet where only designated cells accept input.
- [UI profiles](/cell/options): switch chrome and density with `setUi()` without remounting.
- [Host updates and events](/cell/host-integration): push values from the host and watch the events the sheet emits.
- [Theme and locale switching](/cell/theming): change theme and UI dictionary on a mounted sheet.
- [Overlays inside a native dialog](/cell/modals): keep the sheet and its floating UI inside one dialog boundary.
