# ワークブックを再計算する

再計算はデスクトップアプリではなくバイト列から始まります。

::: tip 実 workbook で早めに試す
Single-formula test は package が load できることの確認です。Representative workbook で file structure、formula、locale assumption が合うか確認してください。
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

構造を保持しながら計算値を更新するため、アップロード検証、サーバー側チェック、バッチ変換に使えます。
