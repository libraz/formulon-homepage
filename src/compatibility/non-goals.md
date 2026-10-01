# Non-goals

These are deliberate boundaries. They keep the engine small and easier to verify, and they make the supported scope explicit when a workbook depends on one of them.

| Area | Reason |
| --- | --- |
| VBA execution | Security. Macro bytes may be preserved on save, but they are not run. |
| Legacy `.xls` (BIFF) | The target is modern Excel 365 behavior; `.xls` belongs to the pre-OOXML era. |
| Chart and drawing rendering | Rendering belongs to a UI or document layer, not to a headless engine. |
| Power Query and DAX | Separate languages and execution models from spreadsheet formulas. |
| Refreshing a pivot cache from worksheet or external source data | Supported cached records can be projected and queried; rebuilding the cache requires a separate execution model. |
| Live external connections (OLE DB, Web, OData) | Production runs must stay deterministic and offline. |
| Spreadsheet UI | Formulon is headless; UIs sit on top. [`formulon-cell`](/cell/) provides an embeddable browser UI kit. |

::: info Glossary: headless engine
A calculation engine with no visual surface and no end-user UI. Hosts call it; humans do not interact with it directly. Headlessness lets the same engine power a server job, a browser tab, a CLI, and a UI library without changing semantics.
:::

## Why be explicit?

A blurred non-goal list invites scope creep and ambiguous compatibility claims. Listing what Formulon will not implement keeps the scope honest:

- Issue triage becomes a yes/no instead of a "maybe someday".
- Compatibility claims stay verifiable.
- Integrators know which neighboring tools they still need.

## Adjacent tools

- VBA / macros → use Excel directly, or a host-specific automation tool.
- Charts and drawings → preserve through Formulon, render with a separate library.
- Power Query → run upstream, write `.xlsx` outputs that Formulon ingests.
- UI → [`formulon-cell`](/cell/) provides a browser spreadsheet UI kit.

## Read next

- [Compatibility model](/compatibility/model) — what *is* in scope.
- [File format support](/compatibility/file-format-support) — preserve vs evaluate.
