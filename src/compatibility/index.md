# Compatibility

Formulon treats compatibility as something you can inspect and reproduce. Use this section when a workbook result differs from Excel, or when you want to understand which formulas and file features are implemented.

::: warning Compatibility is workload-specific
“Excel-compatible” does not mean every workbook behaves exactly like every Excel build. It means the documented profile, implemented function families, file-format support, and oracle tests match the workbook you plan to process.
:::

To see how closely Formulon follows Excel in practice, start with [How far compatibility goes](/compatibility/edge-cases): floating-point, date, coercion, locale and spill cases, each checked live against a value captured from Excel.

## What to check

1. Compare formulas against [Formula coverage](/compatibility/formula-coverage).
2. Check workbook structures in [File format support](/compatibility/file-format-support).
3. Pin the target in [Locale profiles](/compatibility/locale-profiles), then check [Text collation](/compatibility/text-collation) when comparisons, sorting, or lookup results matter.
4. Review [Error model](/compatibility/errors) so spreadsheet errors and host failures are handled separately.

::: info Current status
Formulon remains pre-1.0. Of the **526** recognized names, **511** are real implementations, including the 2 environment-bound functions (`CELL`, `INFO`), and **15** are intentional unavailable service stubs. APIs can still change, so pin versions and keep a small workbook fixture set when results matter.
:::

## Coverage areas

| Area | What to check |
| --- | --- |
| Formula functions | Local implementation count, service stubs, and validation guidance in [Formula coverage](/compatibility/formula-coverage) |
| Files | Read / write / preserve boundaries in [File format support](/compatibility/file-format-support) |
| Locale and language | The 28 profile IDs, locale facts, formula localization, and runtime editor links in [Locale profiles](/compatibility/locale-profiles) and [Workbook language](/workbook/language) |
| Text behavior | Mac measured collation, Windows word sort, and per-function strength in [Text collation](/compatibility/text-collation) |
| Errors | `#VALUE!`, `#REF!`, parser failures, and host exceptions in [Error model](/compatibility/errors) |
| Verification | Captured Excel values per profile, accepted divergences, and the closure checks in [Oracle testing](/compatibility/oracle-testing) |
