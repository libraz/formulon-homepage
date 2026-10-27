# ワークブックを再計算する

ワークブックファイルのバイト列を読み込み、編集して再計算し、結果を保存します。

::: tip 実ワークブックで早めに試す
単一の数式によるテストは、パッケージが正しく読み込めることの確認にしかなりません。実際に使う想定のワークブックで、ファイル構造や数式、ロケールの前提が自分のユースケースに合うかどうかを確認してください。
:::

<DiagramFlow
  :steps="[
    { label: '入力バイト列', note: 'ホストが読み込んだ .xlsx', tone: 'alt' },
    { label: 'Workbook.loadBytes', note: 'Python は Workbook.load' },
    { label: '入力を変更', note: 'setNumber、setFormula' },
    { label: 'recalc()', note: '依存する数式を評価' },
    { label: 'save()', note: '現在の状態を書き出す（再計算なし）' },
    { label: '出力バイト列', note: 'ホストがファイルを保存', tone: 'alt' }
  ]"
  label="ワークブックのバイト列を読み込み、入力を変更して再計算し、新しいバイト列として保存してホストが保管する流れ"
  caption="入力も出力もバイト列で、ファイルの扱いはホストが担い、save() は再計算しません。"
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

プロファイルと固定した時刻は実行時の状態で、出力ファイルには保存されません。読み込むたびに両方を設定し直してください。`setPinnedNow` は `NOW()`、`TODAY()`、相対日付フィルターが読む時刻を固定し、日付に依存する結果を再現できるようにします。

ワークブック内のすべての数式キャッシュを最新にしてから保存するには、先に `recalc()` を実行し、その成功を確認してください。保存処理自体は再計算を行わず、ワークブックが現在保持している値を書き出します。部分再計算では、指定した依存範囲の外にある数式キャッシュが古いまま残る場合があります。Formulon がモデル化している構造は保持され、モデル化していないパートはそのまま書き戻されます。どの情報が残るかはコンテナと機能によって異なるため、[ファイル形式サポート](/ja/compatibility/file-format-support) と保存時の診断を確認してください。同じ未変更のワークブックモデルを 2 回保存すると、各アーカイブ項目に固定タイムスタンプが使われるため、同じバイト列になります。入力ファイルと出力ファイルが同一になるという意味ではありません。

## 読み込みから保存までを試す

下のパネルは、同じ手順をブラウザ内で実行します。ワークブックを選ぶかサンプルを生成すると、バイト列を `loadBytes()` で読み込んで再計算し、`.xlsx` のバイト列として保存したものをダウンロードできます。パネル下のシートは、保存したバイト列を埋め込みの `formulon-cell` グリッドで開き直したものです。画面の値は、元のファイルにキャッシュされていた値ではなく、エンジンが計算した値です。

<RecalcDemo />
