# Filters and validation

Typed AutoFilters and data-validation checks expose spreadsheet decisions without requiring a UI. They operate on the in-memory workbook and use zero-based sheet, row, and column indices.

An AutoFilter definition, its match results, and row visibility are separate states:

| Operation | Changes filter definition? | Changes row visibility? | Calculation state |
| --- | --- | --- | --- |
| `setAutoFilter` | Replaces the criteria | No | Marks visibility-dependent formulas dirty |
| `evaluateAutoFilter` | No | No; returns matches for body rows | Unchanged |
| `applyAutoFilter` | No | Hides non-matching rows and shows matches | Marks dependent formulas such as `SUBTOTAL` dirty; call `recalc()` before reading them |
| `clearAutoFilter` | Clears criteria | Shows all body rows | Marks visibility-dependent formulas dirty |
| `removeAutoFilter` | Removes the definition | Leaves current visibility unchanged | Marks visibility-dependent formulas dirty |

These operations do not run recalculation. After a state-changing operation, call `recalc()` before reading formulas that depend on filtering or row visibility.

## Typed AutoFilters

`getAutoFilter(sheet)` and `getTableAutoFilter(tableIndex)` return a result whose `autoFilter` field is `null` when no filter exists. An `AutoFilter` contains an inclusive `range` (including its header), ordered `columns`, and optional `sort`. Each `AutoFilterColumn.colId` is an offset from the first column of the range. `FilterKind` selects `Values`, `Custom`, `Top10`, `Dynamic`, `Color`, or `Icon`; the corresponding fields carry values, date groups, operators, thresholds, colours, or icons. `SortBy`, `SortMethod`, and `DateTimeGrouping` describe sort and date-group state.

`setAutoFilter` replaces a sheet filter but does not change row visibility. `evaluateAutoFilter` is read-only and returns `firstRow` plus a Boolean `match` array for body rows. `applyAutoFilter` hides excluded rows, shows matching rows, and marks dependent formulas such as `SUBTOTAL` and `AGGREGATE` dirty; recalculate before reading their new values. `clearAutoFilter` drops criteria and shows all body rows. `removeAutoFilter` removes the definition while leaving visibility unchanged. The table variants have the same `get`, `set`, `evaluate`, `apply`, `clear`, and `remove` methods.

Typed writes retain `xr:uid`, `calendarType`, `extLst`, and unknown AutoFilter attributes that the model does not interpret.

The C names are `fm_sheet_get_auto_filter`, `fm_sheet_set_auto_filter`, `fm_sheet_evaluate_auto_filter`, `fm_sheet_apply_auto_filter`, `fm_sheet_clear_auto_filter`, and `fm_sheet_remove_auto_filter`; table calls use `fm_table_*_auto_filter`. The WASM and Native Node method names are camelCase. Python uses `get_auto_filter`, `set_auto_filter`, `evaluate_auto_filter`, `apply_auto_filter`, `clear_auto_filter`, and `remove_auto_filter`.

### Text matching and ordering

Text equality, custom criteria, and AutoFilter ordering use the workbook's active Excel compatibility profile. Every `mac-*` profile follows its measured Mac Excel collation across comparisons, sorting, lookups, grouping, and AutoFilters. `win-*` profiles follow the Windows word sort measured on Windows Excel 365 ja-JP. Profiles are runtime workbook state and are not saved in the file; apply the intended profile again after loading. See [Text collation](/compatibility/text-collation) for the comparison classes and examples.

Value-list matching trims only leading and trailing U+0020 ASCII spaces from both the filter entry and the cell's shown text. Tabs, non-breaking spaces (U+00A0), and ideographic spaces (U+3000) remain significant.

## Data-validation checks

Try a proposed number against a rule that allows 0 through 100. Validation leaves A1 unchanged; the direct-write button shows that an engine write can still store a value that fails the rule. Applications that require rejection must check the validation result before writing.

<ValidationDemo />

`getValidations` reads stored rules and `addValidation` appends one. The rule payload uses OOXML ordinals: `type` 1–7 means whole, decimal, list, date, time, text length, or custom; `op` 0–7 means between, not-between, equal, not-equal, greater-than, less-than, greater-than-or-equal, or less-than-or-equal. `ValidationErrorStyle` is `Stop`, `Warning`, or `Information`. Rule formulas are stored without a leading `=` and read back in that form; a formula that starts with `==` is rejected with `kParserUnexpectedToken`.

`validateValue(sheet, row, col, value)` checks a proposed value without storing it. The result reports `hasRule`, `valid`, `ruleIndex`, and `errorStyle`; when rules overlap, the first stored rule wins. `listInvalidCells` returns populated cells that currently fail a rule in row-major order and supplies a resumable `nextCursor`. Setting a value does not automatically reject it: the host must call `validateValue()`, decide what to do with the result, and then apply an accepted edit separately. To audit an existing workbook, call `listInvalidCells()`. Formula rules — custom formulas, list sources, and rule bounds — evaluate with the proposed value substituted wherever they read the checked cell, including through ranges and indirect references; other cells retain their stored values, and validation does not mutate the workbook. For example, `COUNTIF($A:$A,5)>0` sees a proposed `5` in column A.

For an inline list such as `"Open,Closed"`, validation compares the text Excel shows after trimming leading and trailing U+0020 spaces; a U+0020 after each comma is dropped while parsing the list. Text matches are exact, including case and width. Text that reads as a number is also compared numerically under the active profile, so `01`, full-width `１`, and `1e0` can match `1`, and a percentage can match `50%`. Lists backed by a range keep their existing `MATCH(..., 0)` behavior.

Built-in number-format IDs `5`–`8` and `41`–`44` resolve to the active profile's locale-specific format codes during validation.

`removeValidationAt` and `clearValidations` edit the stored rules. The C calls are `fm_sheet_validate_value`, `fm_sheet_list_invalid_cells`, `fm_sheet_get_validation_at`, `fm_sheet_add_validation`, `fm_sheet_remove_validation_at`, and `fm_sheet_clear_validations`. Python raises `FormulonError` for host-side failures instead of returning a status object.

::: code-group

```js [WASM]
import createFormulon, { FilterKind, ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  for (const [row, value] of ['Name', 'Ada', 'Bob'].entries()) checked(wb.setText(0, row, 0, value), 'setText')
  checked(wb.setAutoFilter(0, { range: { firstRow: 0, firstCol: 0, lastRow: 2, lastCol: 0 }, columns: [{ colId: 0, kind: FilterKind.Values, values: ['Ada'] }], sort: null }), 'setAutoFilter')
  console.log(checked(wb.evaluateAutoFilter(0), 'evaluate').match)
  checked(wb.addValidation(0, { ranges: [{ firstRow: 0, firstCol: 1, lastRow: 0, lastCol: 1 }], type: 3, formula1: '"Open,Closed"' }), 'addValidation')
  console.log(checked(wb.validateValue(0, 0, 1, { kind: ValueKind.Text, number: 0, boolean: 0, text: 'Open', errorCode: 0 }), 'validate').valid)
} finally { wb.delete() }
```

```js [Native Node]
import { FilterKind, ValueKind, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  for (const [row, value] of ['Name', 'Ada', 'Bob'].entries()) checked(wb.setText(0, row, 0, value), 'setText')
  checked(wb.setAutoFilter(0, { range: { firstRow: 0, firstCol: 0, lastRow: 2, lastCol: 0 }, columns: [{ colId: 0, kind: FilterKind.Values, values: ['Ada'] }], sort: null }), 'setAutoFilter')
  console.log(checked(wb.evaluateAutoFilter(0), 'evaluate').match)
  checked(wb.addValidation(0, { ranges: [{ firstRow: 0, firstCol: 1, lastRow: 0, lastCol: 1 }], type: 3, formula1: '"Open,Closed"' }), 'addValidation')
  console.log(checked(wb.validateValue(0, 0, 1, { kind: ValueKind.Text, number: 0, boolean: 0, text: 'Open', errorCode: 0 }), 'validate').valid)
} finally { wb.dispose() }
```

```python [Python]
from formulon import AutoFilter, AutoFilterColumn, DataValidationInput, FormulonError, FilterKind, MergeRange, Value, ValueKind, Workbook

try:
    with Workbook.create_default() as wb:
        for row, value in enumerate(('Name', 'Ada', 'Bob')):
            wb.set_text(0, row, 0, value)
        wb.set_auto_filter(0, AutoFilter(MergeRange(0, 0, 2, 0), [AutoFilterColumn(0, kind=FilterKind.VALUES, values=['Ada'])]))
        print(wb.evaluate_auto_filter(0)[1])
        wb.add_validation(0, DataValidationInput(type=3, ranges=[MergeRange(0, 1, 0, 1)], formula1='"Open,Closed"'))
        print(wb.validate_value(0, 0, 1, Value(ValueKind.TEXT, text='Open')).valid)
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

XLSB input filters are not exposed through the typed API. Saving XLSB omits typed AutoFilter edits and reports a diagnostic. Top-N or average criteria use all body rows. Validation rules are preserved, but no binding enforces them during mutation.
