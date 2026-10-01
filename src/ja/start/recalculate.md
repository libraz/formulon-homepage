# ワークブックを再計算する

ワークブックファイルのバイト列を読み込み、編集して再計算し、結果を保存します。

::: tip 実ワークブックで早めに試す
単一の数式によるテストは、パッケージが正しく読み込めることの確認にしかなりません。実際に使う想定のワークブックで、ファイル構造や数式、ロケールの前提が自分のユースケースに合うかどうかを確認してください。
:::

<DiagramFlow steps="入力バイト列 → Workbook.loadBytes / Workbook.load → セルを変更 → recalc() → save() → 出力バイト列" />

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

エンジンは対応するワークブック構造を保持しながら計算値を更新し、モデル化していないパートはそのまま保持します。保持・変換できる機能はコンテナと機能によって異なるため、[ファイル形式サポート](/ja/compatibility/file-format-support) と保存時の診断を確認してください。このパスは、サーバー側の検証、ブラウザからのアップロード処理、バッチ変換、既知のワークブックに対する回帰テストに使えます。

## 読み込みから保存までを試す

下のパネルは、同じ手順をブラウザ内で実行します。ワークブックを選ぶ（またはサンプルを生成する）と、バイト列を `loadBytes()` で読み込み、再計算し、`.xlsx` のバイト列として書き出したものをダウンロードできます。パネル内のシートは、その書き出したバイト列を埋め込みの `formulon-cell` グリッドで開き直したものなので、画面に並ぶ値はファイルに保存されていた値ではなくエンジンが計算した値です。

<RecalcDemo />
