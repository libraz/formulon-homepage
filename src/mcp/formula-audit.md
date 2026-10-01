---
description: Find repeated formula gaps, constants, outliers, and errors for review without automatically changing the workbook.
---

# Auditing formula patterns

`formulon_audit_formulas` compares formulas in a bounded range with nearby formulas on the vertical axis, horizontal axis, or both. It reports cells that are constants, blanks, formula-pattern outliers, or formula errors inside a repeated run.

The audit is a review tool. It does not repair a cell, prove that a formula is correct, or infer the business rule that a formula should implement. A formula copied consistently into every row can still be wrong in every row.

## How the comparison works

For each formula, the server creates a relative formula fingerprint. Copied references such as `=B2*C2` and `=B3*C3` therefore share a pattern. A candidate is reported only when neighboring formula peers support one expected pattern on both sides of the candidate. Completely blank rows or columns are hard boundaries: the audit does not use a formula across that boundary as a peer.

Include populated input columns in the audited range. In a calculation table with inputs in `B:C` and formulas in `D`, audit `B2:D200`, not only `D2:D200`. The input cells keep each data row populated, so an empty output cell can be distinguished from a blank separator row. Header rows, totals, intentional overrides, and business rules still require human review.

The four finding types are:

| Type | Meaning |
| --- | --- |
| `constant_in_formula_run` | A non-formula value appears where neighboring rows or columns use the same formula pattern. |
| `blank_in_formula_run` | A blank cell appears inside a supported formula run. |
| `formula_pattern_outlier` | A formula exists, but its normalized pattern differs from the expected neighboring pattern. |
| `formula_error` | The formula's current value is an Excel error value. This finding does not require neighboring pattern support. |

The audit can inspect vertically, horizontally, or on both axes. `both` can attach more than one issue to a cell; the finding has `direction: "both"` and lists the contributing `directions`.

## Input and limits

The exact `formulon_audit_formulas` input is:

| Field | Default and constraints |
| --- | --- |
| `sessionId` | Required open session. |
| `sheet` | First sheet when omitted. A sheet name or zero-based index. |
| `range` | Optional A1 range. A qualified range selects its sheet. Without it, the complete stored used rectangle is audited. |
| `direction` | `"vertical"` by default; `"horizontal"` or `"both"` are also accepted. |
| `window` | `5` by default; an integer from `2` through `50`. |
| `minPeers` | `3` by default; an integer from `3` through `20`, and no greater than `2 * window`. |
| `maxCells` | `50_000` by default; an integer from `1` through `50_000`. The selected rectangle must fit. |
| `maxFindings` | `100` by default; an integer from `1` through `500`. |
| `recalc` | `false` by default. When true, recalculate before reading values and mark the session dirty. |

The complete stored used rectangle is not silently truncated when `range` is omitted. An explicit range is checked by area before scanning. The server still enumerates the sheet's stored cells to discover formulas and rejects a sheet with more than 1,000,000 stored cells; an explicit small range does not bypass that inventory cap.

Formula text in one finding is limited to 256 characters, and normalized patterns are limited to 1,024 characters. The corresponding `formulaTextTruncated`, `patternTextTruncated`, and `expectedPatternTextTruncated` fields identify truncation. Text cell values in findings are limited to 256 characters with `textTruncated` when needed.

## Result fields

The result has this shape:

```json
{
  "complete": true,
  "session": { "id": "formula-review", "dirty": false },
  "sheet": 0,
  "sheetName": "Sheet1",
  "range": "B2:D12",
  "direction": "vertical",
  "window": 5,
  "minPeers": 3,
  "scannedCells": 33,
  "formulaCells": 9,
  "unsupportedFormulaCells": 0,
  "findingCount": 4,
  "findings": [],
  "findingsTruncated": false,
  "warnings": []
}
```

The example uses an abbreviated empty `findings` array only to show the envelope. Each finding includes `type`, `direction`, `directions`, `sheet`, `sheetName`, zero-based `row` and `col`, A1 `a1`, qualified `ref`, current `value`, `count`, `considered`, `nearestSamples`, `confidence`, an `issues` array, and the fixed `reviewNote`. Formula findings also include `formula`; pattern findings include `pattern` and, when a peer pattern exists, `expectedPattern`. `nearestSamples.before` and `.after` contain up to three nearby formula/constant/blank samples with A1 addresses, values, and available formula and pattern text.

`confidence` is the supporting peer ratio rounded to two decimal places and capped at `0.99` for pattern findings. Formula errors use confidence `1`. `unsupportedFormulaCells` counts formulas whose syntax could not be normalized for pattern comparison. Those formulas are excluded from pattern comparisons and reported in `warnings`. `complete: true` means the selected range was scanned; it does not mean every formula was normalized or every finding was returned. Check both `unsupportedFormulaCells` and `findingsTruncated`. The result's `findingsTruncated` flag indicates that more finding groups existed than `maxFindings`; `findingCount` still reports the total groups found.

## Reproducible example: review a calculation column

This prompt asks an agent to find a copied-formula mistake without silently editing it:

```text
Open the calculation workbook as session "formula-review". Audit Data!B2:D12 vertically with window 5, minPeers 3, maxCells 50, and recalc true. Include the populated input columns B:C so blank rows remain boundaries. Report every finding by A1 address and type. Do not repair anything until the findings are reviewed. Read the audited range with formulas, preview it to /tmp/formula-review.png, save the reviewed session as /tmp/formula-review.xlsx, inspect losses, and close the session.
```

Open an empty workbook for a small reproducible dataset:

#### `formulon_open_workbook`

```json
{
  "sessionId": "formula-review"
}
```

Rename the initial sheet before writing the qualified `Data!` range:

#### `formulon_sheet_operation`

```json
{
  "sessionId": "formula-review",
  "operation": "rename",
  "index": 0,
  "newName": "Data"
}
```

Write the input columns and repeated formulas. The input values keep every row in the selected run populated. `D5` is a constant, `D7` is blank, `D9` uses a different formula pattern, and `D11` produces a formula error after recalculation.

#### `formulon_set_range`

```json
{
  "sessionId": "formula-review",
  "start": "Data!B2",
  "values": [
    [2, 2, { "f": "=B2*C2" }],
    [3, 2, { "f": "=B3*C3" }],
    [4, 2, { "f": "=B4*C4" }],
    [5, 2, 99],
    [6, 2, { "f": "=B6*C6" }],
    [7, 2, { "blank": true }],
    [8, 2, { "f": "=B8*C8" }],
    [9, 2, { "f": "=B9+C9" }],
    [10, 2, { "f": "=B10*C10" }],
    [11, 2, { "f": "=1/0" }],
    [12, 2, { "f": "=B12*C12" }]
  ],
  "recalc": true
}
```

Audit the complete selected block. The tool name is immediately before the payload so an agent can execute it directly:

#### `formulon_audit_formulas`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "direction": "vertical",
  "window": 5,
  "minPeers": 3,
  "maxCells": 50,
  "maxFindings": 100,
  "recalc": true
}
```

The meaningful finding addresses are:

```text
D5  constant_in_formula_run
D7  blank_in_formula_run
D9  formula_pattern_outlier
D11 formula_error
```

The envelope reports `scannedCells: 33`, `formulaCells: 9`, `findingCount: 4`, `findingsTruncated: false`, and a review note on every finding. `D11` carries an error value and does not need `expectedPattern`. The exact fingerprint strings are returned in `pattern` and `expectedPattern`; do not reconstruct them from the address.

Read the range before deciding on repairs:

#### `formulon_get_range`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "includeFormulas": true,
  "recalc": false,
  "maxCells": 50
}
```

The response is sparse and includes the raw value envelope and formula text for each stored cell. Use the finding's `nearestSamples` and the surrounding business context to decide whether each candidate is intentional. The audit does not distinguish a deliberate override from an accidental constant by itself.

## Inspect, repair explicitly, and rerun

After review, an agent can repair only the cells approved by the caller. This payload restores the repeated formula pattern in all four findings:

#### `formulon_set_cells`

```json
{
  "sessionId": "formula-review",
  "recalc": true,
  "mutations": [
    { "type": "formula", "a1": "Data!D5", "formula": "=B5*C5" },
    { "type": "formula", "a1": "Data!D7", "formula": "=B7*C7" },
    { "type": "formula", "a1": "Data!D9", "formula": "=B9*C9" },
    { "type": "formula", "a1": "Data!D11", "formula": "=B11*C11" }
  ]
}
```

The mutation response should contain an empty `errorCells` array for these formulas. Read the repaired block and rerun the same audit:

#### `formulon_audit_formulas`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "direction": "vertical",
  "window": 5,
  "minPeers": 3,
  "maxCells": 50,
  "recalc": true
}
```

For this dataset, the rerun reports `findingCount: 0` and `warnings: []`. That result says the selected cells now agree with their neighbors and have no current formula errors. It does not prove that multiplication is the intended business calculation.

Preview the repaired range:

#### `formulon_preview_range`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "scale": 1,
  "showGridLines": true,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/formula-review.png"
}
```

The first MCP content item is the PNG image. The following JSON metadata reports the selected range, current rendered cell text and geometry, page breaks, fonts, page count, and approximation warnings.

Save the reviewed workbook to a separate output path, inspect `losses`, and close the session:

#### `formulon_save_session`

```json
{
  "sessionId": "formula-review",
  "outputPath": "/tmp/formula-review.xlsx"
}
```

#### `formulon_close_workbook`

```json
{
  "sessionId": "formula-review"
}
```

## Recalculation and failure boundaries

With `recalc: false`, the audit reads current cached values. With `recalc: true`, the server marks the session dirty before calling the engine because recalculation can change cached results before reporting a failure. A failed recalculation therefore requires an inspection of the session before deciding whether to save or reopen the source.

The audit itself does not write formulas. A successful read leaves the dirty flag unchanged. Saving to `.xlsx` is the usual choice for a reviewed workbook; inspect writer `losses` before treating the output as complete.
