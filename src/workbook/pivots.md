# PivotTables

A PivotTable has two separate parts: a **pivot cache** holding the source fields and records, and a **pivot table** that places and aggregates those fields on a worksheet. Create the cache first, give it a worksheet source, then create and configure the pivot table.

Formulon projects the configured cache into cells with `pivotLayout()`. It does not rebuild a pivot cache from a worksheet or run external connections. Populate a newly authored cache explicitly, and keep its declared worksheet source aligned with the source data.

## Create a simple summary

This example creates a `Region` / `Amount` cache, then places a row-label and a sum at `E1`. `PivotAxis.Row` is `0`, `PivotAxis.Value` is `2`, and `PivotAggregation.Sum` is `0` when a host uses the C ABI directly.

```ts
import createFormulon, { PivotAggregation, PivotAxis } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
```

::: code-group

```ts [WASM / Native Node]
const cacheId = wb.pivotCacheCreate(0).index
wb.pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:B3', sheet: 'Sheet1' })
wb.pivotCacheFieldAdd(cacheId, 'Region')
wb.pivotCacheFieldAdd(cacheId, 'Amount')

for (const [region, amount] of [['East', 10], ['West', 30]]) {
  const record = wb.pivotCacheRecordAdd(cacheId).index
  wb.pivotCacheRecordSetText(cacheId, record, 0, region)
  wb.pivotCacheRecordSetNumber(cacheId, record, 1, amount)
}

const pivot = wb.pivotCreate(0, 'SalesSummary', cacheId, 0, 4)
wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Region', axis: PivotAxis.Row })
const amount = wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Amount', axis: PivotAxis.Value })
wb.pivotDataFieldAdd(0, pivot.index, {
  name: 'Sum of Amount', fieldIndex: amount.index, aggregation: PivotAggregation.Sum
})
```

```python [Python]
from formulon import PivotAggregation, PivotAxis, PivotDataFieldSpec, PivotFieldSpec, PivotWorksheetSource

cache_id = wb.pivot_cache_create()
wb.set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:B3', sheet='Sheet1'))
wb.pivot_cache_field_add(cache_id, 'Region')
wb.pivot_cache_field_add(cache_id, 'Amount')

for region, amount in [('East', 10), ('West', 30)]:
    record = wb.pivot_cache_record_add(cache_id)
    wb.pivot_cache_record_set_text(cache_id, record, 0, region)
    wb.pivot_cache_record_set_number(cache_id, record, 1, amount)

pivot = wb.pivot_create(0, 'SalesSummary', cache_id, 0, 4)
wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Region', axis=PivotAxis.ROW))
amount = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Amount', axis=PivotAxis.VALUE))
wb.pivot_data_field_add(0, pivot, PivotDataFieldSpec(
    name='Sum of Amount', field_index=amount, aggregation=PivotAggregation.SUM
))
```

:::

All workbook coordinates are zero-based, so the pivot anchor `(0, 4)` is `E1`. The cache source is required before saving a newly authored pivot. A cache without it would produce a package Excel offers to repair, so `save()` fails instead.

### Address a cache item by index

Use `pivotFieldAddItemAt()` / `pivot_field_add_item_at()` when a manual filter must bind to a cache shared-item index. This is the form that can express the blank member: an empty label passed to `pivotFieldAddItem()` is text matching and cannot identify the blank item. The index is the same zero-based space as the OOXML pivot item `x` attribute. An index that does not resolve yet is accepted and filters nothing, so populate the cache before evaluating the pivot when the item must match records.

```ts [WASM / Native Node]
wb.pivotFieldAddItemAt(0, pivot.index, /*fieldIdx*/ 0, /*cacheIndex*/ 2, false)
```

```python [Python]
wb.pivot_field_add_item_at(0, pivot, 0, 2, False)  # field_idx=0, cache_index=2
```

## Inspect the projected result

`pivotLayout()` / `pivot_layout()` returns the projected rectangle and cells. It is the programmatic view of the pivot result; save the workbook when the output needs to be opened in Excel.

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

## Boundaries

- A new cache is not automatically populated from its declared worksheet range. Add its fields and records explicitly.
- The source range is metadata required for a valid saved workbook; it does not schedule a cache refresh.
- External connections and PivotCache recalculation are outside Formulon's local calculation model.
- Existing PivotTables can be read, updated, projected, and preserved. XLSB `pivotCacheDefinition`, `pivotCacheRecords`, and pivot-table parts are evaluated when their record encoding is supported; an unmeasured encoding is skipped rather than guessed. Keep source-workbook compatibility checks in place when files contain features outside the documented model.

## Read next

- [Workbook operations](/workbook/operations) — the broader workbook editing surface.
- [File formats](/workbook/file-formats) — PivotTable and PivotCache preservation boundaries.
- [Compatibility non-goals](/compatibility/non-goals) — external connections and local-engine scope.
