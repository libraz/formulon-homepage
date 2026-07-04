# Compatibility

Formulon treats compatibility as something you can inspect and reproduce. Use this section when a workbook result differs from Excel, or when you want to understand which formulas and file features are implemented.

::: warning Compatibility is workload-specific
“Excel-compatible” does not mean every workbook behaves exactly like every Excel build. It means the documented profile, implemented function families, file-format support, and oracle tests match the workbook you plan to process.
:::

## What to check

1. Compare formulas against [Formula coverage](/compatibility/formula-coverage).
2. Check workbook structures in [File format support](/compatibility/file-format-support).
3. Review [Error model](/compatibility/errors) so spreadsheet errors and host failures are handled separately.

::: info Current status
Formulon is still pre-1.0 (currently 0.9.4). The function catalog is fully registered: of the **522** recognized names, **505** are unconditionally real local implementations, **2** more (`CELL`, `INFO`) also run locally but are environment-bound — some results depend on workbook or host state — and the remaining **15** are intentional unavailable service stubs. APIs can still change, so pin versions and keep a small workbook fixture set when results matter.
:::

## Coverage areas

| Area | What to check |
| --- | --- |
| Formula functions | Local implementation count, service stubs, and validation guidance in [Formula coverage](/compatibility/formula-coverage) |
| Files | Read / write / preserve boundaries in [File format support](/compatibility/file-format-support) |
| Errors | `#VALUE!`, `#REF!`, parser failures, and host exceptions in [Error model](/compatibility/errors) |
| Status | Pre-1.0 APIs, 505 / 522 local function implementations, formula plus workbook oracle verification |
