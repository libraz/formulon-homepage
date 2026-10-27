# Recalculate a Workbook

Load workbook bytes, change inputs, recalculate, and save new bytes. No desktop application is involved.

::: tip Test with a real workbook early
Single-formula tests prove the package loads. A representative workbook proves whether file structures, formulas, and locale assumptions fit your use case.
:::

<DiagramFlow
  :steps="[
    { label: 'Input bytes', note: 'An .xlsx read by the host', tone: 'alt' },
    { label: 'Workbook.loadBytes', note: 'Python: Workbook.load' },
    { label: 'Change inputs', note: 'setNumber, setFormula' },
    { label: 'recalc()', note: 'Evaluates dependent formulas' },
    { label: 'save()', note: 'Writes current state, no recalculation' },
    { label: 'Output bytes', note: 'The host stores the file', tone: 'alt' }
  ]"
  label="Load workbook bytes, change inputs, recalculate, then save new bytes for the host to store"
  caption="Bytes in, bytes out: the host owns the files, and save() does not recalculate."
/>

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

  check(workbook.setExcelProfileId('win-365-en_US'))
  check(workbook.setPinnedNow(2026, 10, 9, 9, 30, 0))
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
    wb.set_excel_profile_id("win-365-en_US")
    wb.set_pinned_now(2026, 10, 9, 9, 30, 0)
    wb.set_number(0, 3, 1, 125000.0)
    wb.recalc()
    output = wb.save()

with open("output.xlsx", "wb") as f:
    f.write(output)
```

## CLI

```sh
formulon recalc --profile win-365-en_US --now 2026-10-09T09:30:00 input.xlsx -o output.xlsx
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values output.xlsx
```

The profile and the pinned clock are runtime state: neither is saved in the output file, so set both again after every load. `setPinnedNow` fixes what `NOW()`, `TODAY()` and relative date filters read, which keeps date-dependent results reproducible.

Call `recalc()` successfully before saving when every formula cache in the workbook must be current. Saving writes the values currently held by the workbook; it does not run a recalculation itself. A partial recalculation may leave formula caches outside its requested dependency closure unchanged. Saving keeps the workbook structures Formulon models and passes through parts it does not model. What survives depends on the container and the feature; check [File format support](/compatibility/file-format-support) and the save diagnostics. Saving the same unchanged in-memory workbook twice produces identical bytes because each saved archive entry uses a fixed timestamp; this does not mean the output bytes match the original input file.

## Run the round trip here

The panel below runs the same sequence in the browser. Pick a workbook, or let it generate a sample; the bytes are parsed with `loadBytes()`, recalculated, and saved back to `.xlsx` bytes you can download. The sheet under the panel reopens those saved bytes in an embedded `formulon-cell` grid, so the values on screen are what the engine computed, not the values cached in the original file.

<RecalcDemo />
