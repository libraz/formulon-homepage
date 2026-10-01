# Recalculate a Workbook

Recalculation starts with bytes, not with a desktop application.

::: tip Test with a real workbook early
Single-formula tests prove the package loads. A representative workbook proves whether file structures, formulas, and locale assumptions fit your use case.
:::

<DiagramFlow steps="Bytes in → Workbook.loadBytes / Workbook.load → Mutate cells → recalc() → save() → Bytes out" />

## JavaScript / WASM

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const workbook = Module.Workbook.loadBytes(xlsxBytes)
const check = (status: { ok: boolean; message: string; context: string }) => {
  if (!status.ok) throw new Error(`${status.message}: ${status.context}`)
}

try {
  if (!workbook.isValid()) {
    throw new Error(Module.lastErrorMessage())
  }

  check(workbook.setNumber(0, 3, 1, 125000)) // sheet 0, B4
  check(workbook.recalc())

  const saved = workbook.save()
  if (!saved.status.ok || saved.bytes === null) {
    throw new Error(`${saved.status.message}: ${saved.status.context}`)
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

The engine updates calculated values while preserving supported workbook structures and passing through parts it does not model. The preservation and conversion boundary depends on the container and feature; check [file format support](/compatibility/file-format-support) and save diagnostics. Use this path for server-side checks, browser uploads, batch conversions, and regression tests against known workbooks.

## Run the round trip here

The panel below performs that same sequence in the browser: pick a workbook — or let it generate the sample — and the bytes are parsed with `loadBytes()`, recalculated, and serialized back to `.xlsx` bytes you can download. The sheet under the panel is those serialized bytes reopened in an embedded `formulon-cell` grid, so the values on screen are what the engine computed rather than what the file happened to carry.

<RecalcDemo />
