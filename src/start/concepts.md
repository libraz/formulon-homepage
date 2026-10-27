# Basic concepts

Formulon works with spreadsheet files without starting Excel. Before choosing a package, distinguish the calculation engine, the interface around it, and the workbook data they share.

## Choose the part that does your task

| Product | Responsibility | Start here |
| --- | --- | --- |
| Formulon | Load and edit workbook data, evaluate formulas, recalculate, and save files | [Choose a surface](/start/choose-runtime) |
| formulon-cell | Display an editable spreadsheet in a browser, using the Formulon engine | [Embed a spreadsheet](/cell/install) |
| formulon-mcp | Let an AI client call workbook tools through a local server | [Connect an MCP client](/mcp/install) |

The engine does not need either of the other products. Cell and MCP use the engine, but add their own behavior: Cell updates a mounted UI; MCP manages sessions and file paths. Follow the guide for the layer your application calls.

## Workbook, sheet, cell, and range

A **workbook** contains worksheets and shared structures such as styles and defined names. A **cell** is one row/column position on a sheet. A **range** is a rectangular area of cells.

Human-readable A1 addresses start at row 1 and column A. Numeric API coordinates start at zero. Sheet names are separate from sheet indexes; the first sheet is not necessarily named `Sheet1`.

| Address in a workbook whose first sheet is `Sheet1` | Sheet index | Row index | Column index |
| --- | --- | --- | --- |
| `Sheet1!A1` | 0 | 0 | 0 |
| `Sheet1!B2` | 0 | 1 | 1 |
| `Sheet1!A1:B2` | 0 | 0 through 1 | 0 through 1 |

Range bounds are inclusive. The last range above contains four cells. When an API accepts a range object, use the field names in that API: engine ranges and Cell viewport options do not use identical property names. See [Workbook operations](/workbook/operations) and [Cell options](/cell/options).

## A formula, its value, and its display are different

Consider `A1` containing `100` and `B1` containing `=A1*2`:

| Part | Example | Meaning |
| --- | --- | --- |
| Literal input | `100` in A1 | A stored number; it is not a formula |
| Formula text | `=A1*2` in B1 | The expression the engine evaluates |
| Calculated value | `200` in B1 after recalculation | The result held in the formula cell's cache |
| Number format | `0.00` | A rule for displaying a number |
| Display text | `200.00` | The formatted string; the underlying value is still the number `200` |

An error such as `#DIV/0!` is also a spreadsheet value. It differs from a host API failure such as an invalid sheet index. See [Error model](/compatibility/errors).

## Editing and recalculation are separate steps

Changing A1 to `150` makes B1 need recalculation. On the direct engine API, reading or saving the workbook does not itself run the calculation. Call `recalc()` and check that it succeeded before expecting B1 to contain `300`.

<DiagramFlow
  :steps="[
    { label: 'Write input', note: 'A1 becomes 150' },
    { label: 'Recalculate', note: 'B1 evaluates A1 × 2' },
    { label: 'Read result', note: 'B1 is 300' },
    { label: 'Save bytes', note: 'host writes the output file' }
  ]"
  label="A direct engine edit followed by recalculation, reading, and saving"
  caption="On the direct engine API, reading or saving never recalculates; call recalc() first."
/>

Loading a file initially reads the cached values stored in it. Full recalculation updates the workbook; partial recalculation updates the requested output cells and the inputs they depend on, leaving unrelated results pending. Cell and MCP can call recalculation as part of their higher-level operations; check those operations' defaults rather than assuming every read recalculates. See [Workbook lifecycle](/workbook/lifecycle), [Recalculation](/workbook/recalculation), and [MCP workflow](/mcp/workflow).

## Three settings called “profile” or “locale”

| Setting | What it changes |
| --- | --- |
| Excel compatibility profile, such as `win-365-en_US` | Calculation behavior, text comparison, and locale-sensitive formatting |
| Cell UI locale, such as `en` or `ja` | Translated controls; `setLocale()` also coordinates the mounted workbook's calculation profile |
| Cell UI profile, such as `embedded` or `full` | Which spreadsheet controls and features are shown |

These settings do not select the host language or package. A UI profile selects controls independently of calculation compatibility and translation.

Stored formulas use invariant English names. A displayed formula can be localized and converted back before storage. The calculation profile is a runtime setting that must be applied again after loading; choosing it does not translate stored formulas. See [Formula language](/workbook/language) and the [language switching demo](/cell/language-switching).

## Continue with one working example

Choose an [execution surface](/start/choose-runtime), then [install](/start/install) and [evaluate a formula](/start/evaluate). That page has a live demo for both standalone formulas and formulas that read workbook cells. Then [recalculate a representative workbook](/start/recalculate) to check the behavior your application needs. The [glossary](/glossary) defines terms used throughout the guides.
