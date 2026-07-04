# ワークブックを再計算する

再計算はデスクトップアプリではなくバイト列から始まります。

::: tip 実ワークブックで早めに試す
単一の数式によるテストは、パッケージが正しく読み込めることの確認にしかなりません。実際に使う想定のワークブックで、ファイル構造や数式、ロケールの前提が自分のユースケースに合うかどうかを確認してください。
:::

<DiagramFlow steps="入力バイト列 → Workbook.loadBytes / Workbook.load → セルを変更 → recalc() → save() → 出力バイト列" />

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

エンジンはワークブックの構造を保持したまま計算値を更新します。このパスは、サーバー側の検証、ブラウザからのアップロード処理、バッチ変換、既知のワークブックに対する回帰テストに使えます。
