# PivotTables

A PivotTable has two separate parts: a **pivot cache** holding the source fields and records, and a **pivot table** that places and aggregates those fields on a worksheet. Create the cache first, give it a worksheet source, then create and configure the pivot table.

Formulon projects the configured cache into cells with `pivotLayout()`. It does not rebuild a pivot cache from a worksheet or run external connections. Populate a newly authored cache explicitly, and keep its declared worksheet source aligned with the source data.

## Create a simple summary

This example creates a `Region` / `Product` / `Sales` cache and configures a row hierarchy with a sum anchored at `E1`. The worksheet source and cache records contain the same header and data rows, so an Excel refresh has a consistent source. `pivotLayout()` returns the projected cells for host rendering; it does not write those values into worksheet cells. `PivotAxis.Row` is `0`, `PivotAxis.Value` is `2`, and `PivotAggregation.Sum` is `0` when a host uses the C ABI directly.

::: code-group

```ts [WASM]
import createFormulon, {
  PivotAggregation, PivotAxis, ValueKind,
} from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
type StatusLike = { ok: boolean; message: string }
const requireOk = <T extends StatusLike | { status: StatusLike }>(result: T): T => {
  const status: StatusLike = 'ok' in result ? result as StatusLike : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  const cacheId = requireOk(wb.pivotCacheCreate(0)).index
  requireOk(wb.pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C3', sheet: 'Sheet1' }))
  requireOk(wb.setText(0, 0, 0, 'Region'))
  requireOk(wb.setText(0, 0, 1, 'Product'))
  requireOk(wb.setText(0, 0, 2, 'Sales'))
  requireOk(wb.setText(0, 1, 0, 'East'))
  requireOk(wb.setText(0, 1, 1, 'Widget'))
  requireOk(wb.setNumber(0, 1, 2, 10))
  requireOk(wb.setText(0, 2, 0, 'West'))
  requireOk(wb.setText(0, 2, 1, 'Gadget'))
  requireOk(wb.setNumber(0, 2, 2, 30))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Region'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Product'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Sales'))

  const rows: Array<[string, string, number]> = [
    ['East', 'Widget', 10], ['West', 'Gadget', 30],
  ]
  for (const [region, product, sales] of rows) {
    const record = requireOk(wb.pivotCacheRecordAdd(cacheId)).index
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 0, region))
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 1, product))
    requireOk(wb.pivotCacheRecordSetNumber(cacheId, record, 2, sales))
  }

  const pivot = requireOk(wb.pivotCreate(0, 'SalesSummary', cacheId, 0, 4))
  const regionField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Region', axis: PivotAxis.Row }))
  const productField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Product', axis: PivotAxis.Row }))
  const salesField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Sales', axis: PivotAxis.Value }))
  requireOk(wb.pivotSetRowFieldOrder(
    0, pivot.index, [regionField.index, productField.index],
  ))
  const fmt = requireOk(wb.addNumFmt('#,##0.00'))
  requireOk(wb.pivotDataFieldAdd(0, pivot.index, {
    name: 'Sum of Sales', fieldIndex: salesField.index, aggregation: PivotAggregation.Sum,
    numberFormat: String(fmt.numFmtId)
  }))

  requireOk(wb.pivotFieldSetNumberFormat(0, pivot.index, salesField.index, String(fmt.numFmtId)))
  const layout = requireOk(wb.pivotLayout(0, pivot.index))
  const labels = layout.cells.map((cell) => cell.value.text).filter(Boolean)
  if (!labels.includes('East') || !labels.includes('West')) throw new Error('Pivot row labels are missing')
  const anchor = wb.getValue(0, 0, 4)
  if (!anchor.status.ok || anchor.value.kind !== ValueKind.Blank) throw new Error('pivotLayout wrote E1')
  console.log(labels)
} finally {
  wb.delete()
}
```

```ts [Native Node]
import {
  PivotAggregation, PivotAxis, ValueKind, Workbook,
} from '@libraz/formulon-native'

const wb = Workbook.createDefault()
type StatusLike = { ok: boolean; message: string }
const requireOk = <T extends StatusLike | { status: StatusLike }>(result: T): T => {
  const status: StatusLike = 'ok' in result ? result as StatusLike : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  const cacheId = requireOk(wb.pivotCacheCreate(0)).index
  requireOk(wb.pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C3', sheet: 'Sheet1' }))
  requireOk(wb.setText(0, 0, 0, 'Region'))
  requireOk(wb.setText(0, 0, 1, 'Product'))
  requireOk(wb.setText(0, 0, 2, 'Sales'))
  requireOk(wb.setText(0, 1, 0, 'East'))
  requireOk(wb.setText(0, 1, 1, 'Widget'))
  requireOk(wb.setNumber(0, 1, 2, 10))
  requireOk(wb.setText(0, 2, 0, 'West'))
  requireOk(wb.setText(0, 2, 1, 'Gadget'))
  requireOk(wb.setNumber(0, 2, 2, 30))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Region'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Product'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Sales'))

  const rows: Array<[string, string, number]> = [
    ['East', 'Widget', 10], ['West', 'Gadget', 30],
  ]
  for (const [region, product, sales] of rows) {
    const record = requireOk(wb.pivotCacheRecordAdd(cacheId)).index
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 0, region))
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 1, product))
    requireOk(wb.pivotCacheRecordSetNumber(cacheId, record, 2, sales))
  }

  const pivot = requireOk(wb.pivotCreate(0, 'SalesSummary', cacheId, 0, 4))
  const regionField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Region', axis: PivotAxis.Row }))
  const productField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Product', axis: PivotAxis.Row }))
  const salesField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Sales', axis: PivotAxis.Value }))
  requireOk(wb.pivotSetRowFieldOrder(0, pivot.index, [regionField.index, productField.index]))
  const fmt = requireOk(wb.addNumFmt('#,##0.00'))
  requireOk(wb.pivotDataFieldAdd(0, pivot.index, {
    name: 'Sum of Sales', fieldIndex: salesField.index, aggregation: PivotAggregation.Sum,
    numberFormat: String(fmt.numFmtId),
  }))
  requireOk(wb.pivotFieldSetNumberFormat(0, pivot.index, salesField.index, String(fmt.numFmtId)))

  const layout = requireOk(wb.pivotLayout(0, pivot.index))
  const labels = layout.cells.map((cell) => cell.value.text).filter(Boolean)
  if (!labels.includes('East') || !labels.includes('West')) throw new Error('Pivot row labels are missing')
  const anchor = wb.getValue(0, 0, 4)
  if (!anchor.status.ok || anchor.value.kind !== ValueKind.Blank) throw new Error('pivotLayout wrote E1')
  console.log(labels)
} finally {
  wb.dispose()
}
```

```python [Python]
from formulon import (
    PivotAggregation, PivotAxis, PivotDataFieldSpec, PivotFieldSpec,
    PivotWorksheetSource, ValueKind,
    Workbook,
)

with Workbook.create_default() as wb:
    cache_id = wb.pivot_cache_create()
    wb.set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:C3', sheet='Sheet1'))
    wb.set_text(0, 0, 0, 'Region')
    wb.set_text(0, 0, 1, 'Product')
    wb.set_text(0, 0, 2, 'Sales')
    wb.set_text(0, 1, 0, 'East')
    wb.set_text(0, 1, 1, 'Widget')
    wb.set_number(0, 1, 2, 10)
    wb.set_text(0, 2, 0, 'West')
    wb.set_text(0, 2, 1, 'Gadget')
    wb.set_number(0, 2, 2, 30)
    wb.pivot_cache_field_add(cache_id, 'Region')
    wb.pivot_cache_field_add(cache_id, 'Product')
    wb.pivot_cache_field_add(cache_id, 'Sales')

    for region, product, sales in [('East', 'Widget', 10), ('West', 'Gadget', 30)]:
        record = wb.pivot_cache_record_add(cache_id)
        wb.pivot_cache_record_set_text(cache_id, record, 0, region)
        wb.pivot_cache_record_set_text(cache_id, record, 1, product)
        wb.pivot_cache_record_set_number(cache_id, record, 2, sales)

    pivot = wb.pivot_create(0, 'SalesSummary', cache_id, 0, 4)
    region_field = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Region', axis=PivotAxis.ROW))
    product_field = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Product', axis=PivotAxis.ROW))
    sales_field = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Sales', axis=PivotAxis.VALUE))
    wb.pivot_set_row_field_order(0, pivot, [region_field, product_field])
    fmt_id = wb.add_num_fmt('#,##0.00')
    wb.pivot_data_field_add(0, pivot, PivotDataFieldSpec(
        name='Sum of Sales', field_index=sales_field, aggregation=PivotAggregation.SUM,
        number_format=str(fmt_id)
    ))

    wb.pivot_field_set_number_format(0, pivot, sales_field, str(fmt_id))
    layout = wb.pivot_layout(0, pivot)
    labels = [cell.value.text for cell in layout.cells if cell.value.text]
    if 'East' not in labels or 'West' not in labels:
        raise RuntimeError('Pivot row labels are missing')
    if wb.get_value(0, 0, 4).kind is not ValueKind.BLANK:
        raise RuntimeError('pivot_layout wrote E1')
    print(labels)
```

:::

All workbook coordinates are zero-based, so the pivot anchor `(0, 4)` is `E1`. The cache source is required before saving a newly authored pivot. A cache without it would produce a package Excel offers to repair, so `save()` fails instead. The anchor locates the projected result; it does not materialize the returned layout into `E1` or the surrounding worksheet cells.

The focused snippets below are continuations. Insert them before the `finally` / `with` cleanup in a full example above, or repeat the setup in a new live workbook; they cannot run after that workbook has been cleaned up.

### Address a cache item by index

Use `pivotFieldAddItemAt()` / `pivot_field_add_item_at()` when a manual filter must bind to a cache shared-item index. This is the form that can express the blank member: an empty label passed to `pivotFieldAddItem()` is text matching and cannot identify the blank item. The index is the same zero-based space as the OOXML pivot item `x` attribute. An index that does not resolve yet is accepted and filters nothing, so populate the cache before evaluating the pivot when the item must match records.

```ts [WASM / Native Node]
wb.pivotFieldAddItemAt(0, pivot.index, /*fieldIdx*/ 0, /*cacheIndex*/ 2, false)
```

```python [Python]
wb.pivot_field_add_item_at(0, pivot, 0, 2, False)  # field_idx=0, cache_index=2
```

## Inspect the projected result

`pivotLayout()` / `pivot_layout()` returns the projected rectangle and cells. It is a projection for host rendering and does not write ordinary worksheet values. Saving preserves the PivotTable definition and cache for Excel to render; a static report must write the returned cells explicitly with cell setters.

The layout snippet follows the same live-workbook rule: run it before cleanup, or repeat the setup in a new workbook.

::: code-group

```ts [WASM / Native Node]
const layout = wb.pivotLayout(0, pivot.index)
if (!layout.status.ok) throw new Error(layout.status.message)
for (const cell of layout.cells) console.log(cell.row, cell.col, cell.value)
```

```python [Python]
layout = wb.pivot_layout(0, pivot)
for cell in layout.cells:
    print(cell.row, cell.col, cell.value)
```

:::

Use `pivotSetLayout()` / `set_pivot_report_layout()` for compact, tabular, or outline presentation. Field order, subtotals, filters, date grouping, and the aggregation / show-values-as settings are separate operations; the binding declarations are the exhaustive reference.

### Group dates by an explicit day interval

`PivotDateGrouping.Days` / `PivotDateGrouping.DAYS` is Excel's interval-based date grouping. The snippets below assume a separate pivot whose cache includes an `OrderDate` field; `dateField` is the index returned when that field is added. There is no separate week granularity: use `intervalDays: 7` / `interval_days=7` for a seven-day bucket. The date-grouping call takes `startYear` and `endYear` (use `-1` except for a year-truncation bound), then the day interval and the optional Start/End window as Excel serials. Passing `-1` for either serial lets the engine use the field's data minimum as Start and the data maximum plus one day as End. Labels use the bucket's date range; values below or above an explicit window are labelled `<start` or `>end`. A zero interval or a Start after End is rejected.

The date field index is the `index` / returned integer from `pivotFieldAdd()` / `pivot_field_add()`:

::: code-group

```ts [WASM / Native Node]
const dateStatus = wb.pivotFieldSetDateGroup(
  0, pivot.index, dateField.index, PivotDateGrouping.Days, PivotCalendar.Gregorian,
  -1, -1, 7, -1, -1
)
if (!dateStatus.ok) throw new Error(dateStatus.message)
```

```python [Python]
wb.pivot_field_set_date_group(
    0, pivot, date_field, PivotDateGrouping.DAYS, PivotCalendar.GREGORIAN,
    start_year=-1, end_year=-1, interval_days=7,
    start_serial=-1.0, end_serial=-1.0,
)
```

:::

Pivot field and data-field number formats use a decimal `numFmtId` string, not a format code. Use a built-in ID or register a code with `addNumFmt()` / `add_num_fmt()` first, as in the examples above; any other non-empty string is rejected and the ID is written to the pivot part.

## Boundaries

- A new cache is not automatically populated from its declared worksheet range. Add its fields and records explicitly.
- The source range is metadata required for a valid saved workbook; it does not schedule a cache refresh.
- External connections and PivotCache recalculation are outside Formulon's local calculation model.
- Existing PivotTables can be read, updated, projected, and preserved. XLSB `pivotCacheDefinition`, `pivotCacheRecords`, and pivot-table parts are evaluated when their record encoding is supported; an unmeasured encoding is skipped rather than guessed. Keep source-workbook compatibility checks in place when files contain features outside the documented model.

## Read next

- [Workbook operations](/workbook/operations) — the broader workbook editing surface.
- [File formats](/workbook/file-formats) — PivotTable and PivotCache preservation boundaries.
- [Compatibility non-goals](/compatibility/non-goals) — external connections and local-engine scope.
