---
title: formulon-cell extension catalogue
description: The 26 built-in extension factories, their matching feature flag, purpose, and preset inclusion.
---

# Extension Catalogue

This page is the complete factory-by-factory reference for `formulon-cell`'s replaceable chrome. See the [Embedding guide](/cell/embedding#selective-extensions) for the `features` vs `extensions` architecture; this table exists so you can look up one factory without reading the whole guide.

Every entry mounts as part of the reference chrome — useful for integration testing and examples, not a guarantee that a given dialog matches Excel behavior exactly.

::: info Glossary: preset vs extension
A *preset* (`presets.minimal()` / `.standard()` / `.full()`) is a plain `FeatureFlags` object of booleans. An *extension* is a zero-argument factory function that returns an `Extension`. Disabling a feature flag removes the built-in and its DOM; passing the matching factory through `extensions` mounts your own (or the same built-in, reused standalone).
:::

## Factories

Each factory's `id` matches the `FeatureFlags` key `mount.ts` gates it against — disable the flag, then pass the factory (or your own replacement) through `extensions`. Columns show whether the factory is part of the default chrome for each preset:

| Factory | Feature id | Purpose | `minimal()` | `standard()` | `full()` |
| --- | --- | --- | --- | --- | --- |
| `borderDraw` | `borderDraw` | Cell border draw / draw-grid / erase modes | – | ✓ | ✓ |
| `charts` | `charts` | Session chart overlays | – | ✓ | ✓ |
| `clipboard` | `clipboard` | OS clipboard bridge (copy/cut/paste) | ✓ | ✓ | ✓ |
| `commentDialog` | `commentDialog` | Comment edit dialog (Shift+F2) | – | – | ✓ |
| `conditionalDialog` | `conditional` | Conditional-formatting rule manager | – | – | ✓ |
| `contextMenu` | `contextMenu` | Right-click context menu | – | ✓ | ✓ |
| `findReplace` | `findReplace` | Find/Replace dialog (Ctrl+F) | – | ✓ | ✓ |
| `formatDialog` | `formatDialog` | Format Cells dialog (Ctrl+1) | – | – | ✓ |
| `formatPainter` | `formatPainter` | Format painter | – | ✓ | ✓ |
| `goToSpecialDialog` | `gotoSpecial` | Go To Special dialog | – | – | ✓ |
| `hoverComment` | `hoverComment` | Hover-comment popover | – | – | ✓ |
| `hyperlinkDialog` | `hyperlink` | Hyperlink dialog (Ctrl+K) | – | – | ✓ |
| `illustrations` | `illustrations` | Session shape / picture overlays | – | ✓ | ✓ |
| `iterativeDialog` | `iterative` | Iterative-calculation settings dialog | – | – | ✓ |
| `namedRangeDialog` | `namedRanges` | Named-range listing dialog | – | – | ✓ |
| `pageSetupDialog` | `pageSetup` | Page Setup dialog | – | – | ✓ |
| `pasteSpecial` | `pasteSpecial` | Paste-special dialog | – | – | ✓ |
| `pivotTableDialog` | `pivotTableDialog` | PivotTable creation dialog | – | – | ✓ |
| `quickAnalysis` | `quickAnalysis` | Quick Analysis popover (Ctrl+Q) | – | ✓ | ✓ |
| `slicer` | `slicer` | Slicer floating panels | opt-in only | opt-in only | opt-in only |
| `statusBar` | `statusBar` | Bottom status bar (calc mode, zoom, aggregates) | ✓ | ✓ | ✓ |
| `validationList` | `validation` | Validation-list dropdown | – | – | ✓ |
| `viewToolbar` | `viewToolbar` | View ribbon toolbar | – | ✓ | ✓ |
| `watchWindow` | `watchWindow` | Watch Window dock | opt-in only | opt-in only | opt-in only |
| `wheel` | `wheel` | Mouse-wheel scroll handler | ✓ | ✓ | ✓ |
| `workbookObjects` | `workbookObjects` | Workbook Objects side panel | – | ✓ | ✓ |

```ts
import { Spreadsheet, presets, findReplace, formatDialog } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace(), formatDialog()]
})
```

::: warning `watchWindow` and `slicer` default off even in `full()`
These two ids are excluded from the "on unless explicitly disabled" rule that every other feature follows — they start disabled and require an explicit `features: { watchWindow: true }` / `{ slicer: true }` (or the matching factory in `extensions`) to appear, even under `presets.full()`. New panels ship this way so adopting a formulon-cell upgrade never silently grows the default chrome.
:::

## Flag-only features (no factory)

A handful of `FeatureFlags` ids gate behavior that isn't a separate mountable dialog or panel — there is nothing to pass through `extensions` for these, only the boolean flag:

| Feature id | What it gates | `minimal()` | `standard()` | `full()` |
| --- | --- | --- | --- | --- |
| `formulaBar` | The formula input bar | ✓ | ✓ | ✓ |
| `shortcuts` | The built-in spreadsheet keymap | ✓ | ✓ | ✓ |
| `sheetTabs` | The bottom sheet-tab bar | – | ✓ | ✓ |
| `errorIndicators` | Green corner-triangle error markers on cells | – | ✓ | ✓ |
| `autocomplete` | Inline formula/name autocomplete while typing | – | ✓ | ✓ |
| `fxDialog` | Insert Function (fx) dialog / argument helper | – | – | ✓ |

## Non-toggleable core

`nameBox`, `editor`, `pointer`, and `renderer` are not `FeatureFlags` ids at all — they are the spreadsheet surface itself. There is no flag to disable them; removing them would leave no UI to mount.

## Read next

- [Embedding guide](/cell/embedding#selective-extensions) — the `features` vs `extensions` split, headless mounting, command helpers.
- [API surface](/cell/api#extensions) — `MountOptions.extensions`, `presets`.
- [Theming](/cell/theming) — the CSS token surface for whatever chrome you keep on.
