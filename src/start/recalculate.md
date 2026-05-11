# Recalculate a Workbook

Recalculation starts with bytes, not with a desktop application.

::: tip Test with a real workbook early
Single-formula tests prove the package loads. A representative workbook proves whether file structures, formulas, and locale assumptions fit your use case.
:::

## JavaScript / WASM

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const workbook = Module.Workbook.loadBytes(xlsxBytes)

try {
  if (!workbook.isValid()) {
    throw new Error(Module.lastErrorMessage())
  }

  workbook.setNumber(0, 3, 1, 125000) // sheet 0, B4
  workbook.recalc()

  const saved = workbook.save()
  if (!saved.status.ok || saved.bytes === null) {
    throw new Error(saved.status.message)
  }

  await upload(saved.bytes)
} finally {
  workbook.delete()
}
```

## Python

```python
from formulon import Workbook

with open("input.xlsx", "rb") as f:
    blob = f.read()

with Workbook.load(blob) as wb:
    wb.set_number(0, 3, 1, 125000.0)
    wb.recalc()
    output = wb.save()

with open("output.xlsx", "wb") as f:
    f.write(output)
```

## CLI

```sh
formulon recalc input.xlsx -o output.xlsx
formulon dump --values output.xlsx
```

The engine preserves workbook structure while updating calculated values. Use this path for server-side checks, browser uploads, batch conversions, and regression tests against known workbooks.
