# Why Formulon

Formulon is for products that need spreadsheet calculation without embedding Excel. It gives you one C++17 engine and packages that same engine for WebAssembly, Python, native command-line workflows, and direct native embedding.

The project optimizes for reproducible compatibility. The default behavior profile is `win-365-ja_JP`; oracle fixtures record observed Excel behavior, and accepted divergences are tracked explicitly instead of being hidden behind vague "Excel-like" claims.

## What it solves

- Run `.xlsx` and `.xlsb` workbooks in services, jobs, and notebooks.
- Evaluate Excel formulas inside a browser or worker.
- Keep browser, Python, CLI, and native results aligned because they share one core.
- Preserve workbook structure while recalculating values.
- Audit formula behavior against versioned oracle data.

## What it does not try to solve

Formulon is not a spreadsheet UI, chart renderer, VBA runtime, PowerQuery engine, or legacy `.xls` implementation. Those boundaries keep the calculation engine small, testable, and embeddable.

## Current status

Formulon is under active development and is not yet production-ready. The 522-function catalog is fully registered, the file-format layer is substantial, and bindings are wired, but APIs and package layout may still change before the first stable release. Validate business-critical workbooks with fixtures against the Excel profile you target.
