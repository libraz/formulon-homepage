# 数式を評価する

ワークブックファイルを読み込まずにスプレッドシートの結果だけが欲しい場合は、数式を単独で評価します。読み込み済みのワークブックのセルを使って評価する方法は [読み込み済みワークブックに対する評価](#evaluating-against-a-loaded-workbook) を参照してください。

::: info Excel エラーは値
`#DIV/0!`、`#VALUE!`、`#NAME?` はスプレッドシートの値として返ります。ホスト API の失敗は実行入口ごとのステータス付きの戻り値、例外、非ゼロ終了で扱います。
:::

<DiagramLayers
  :layers="[
    {
      title: '数式をどう評価するか',
      nodes: [
        { label: '使い捨ての単発評価', note: 'evalFormula / eval_formula — 新規ワークブックの Sheet1!A1 が基準' },
        { label: '読み込み済みワークブックに対するその場の評価', note: 'evaluateFormulaText — 読み取り専用、JS/WASM と Native Node のみ' },
        { label: 'ワークブックへ書き込んで保持', note: 'setFormula + recalc() — 依存グラフに参加する' }
      ]
    }
  ]"
  label="数式を評価する 3 つの方法"
/>

## JavaScript / WASM

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()

const result = Module.evalFormula('=SUM(1,2,3)')
if (!result.status.ok) {
  throw new Error(result.status.message)
}

if (result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

## Python

```python
import formulon

value = formulon.eval_formula("=SUM(1,2,3)")
print(value.to_python())
```

## ユーザーの Excel ロケールで数式を表示する

保存する数式は、英語の関数名と区切り文字による正規形です。UI では完全な Excel プロファイル ID を `localizeFormula()` に渡して表示上のロケールへ変換できます。編集後の文字列は保存前に `canonicalizeFormula()` で戻し、評価するワークブックにも同じプロファイルを選択してください。

```ts
import createFormulon from '@libraz/formulon'

const LocaleModule = await createFormulon()
const profile = 'mac-365-de_DE'
const localeWorkbook = LocaleModule.Workbook.createDefault()
try {
  const displayed = localeWorkbook.localizeFormula('=SUM(1.5,TRUE)', profile)
  if (!displayed.status.ok) throw new Error(displayed.status.message)
  const canonical = localeWorkbook.canonicalizeFormula(displayed.value, profile)
  if (!canonical.status.ok) throw new Error(canonical.status.message)
} finally {
  localeWorkbook.delete()
}
```

`localizeFormula()` はテキスト変換です。関数名、区切り文字、小数点、真偽値名、エラー名を変換し、文字列、引用符付きシート名、外部修飾子、構造化参照の角括弧は保持します。カスタムエディターに必要な区切り文字、名前、日付順、通貨、ローカライズ済みエラー名は `localeFacts(profile)` から取得できます。エンジンのプロファイルは 28 個あり、`mac-*` と `win-365-ja_JP` は Excel との実測値、残りの Windows プロファイルは推定ロケールデータです。

## CLI

```sh
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
```

`formulon eval --json '=1/0'` は `{"kind":"error","value":"#DIV/0!"}` を出力し、終了コード `0` で終わります。非 0 の終了コードは、使い方の誤りやファイルを読めないといったホスト側の失敗に使われます。

下のパネルで実際に確かめられます。`=1/0` のプリセットを選ぶと、値の種類が `Error`、テキストが `#DIV/0!` の結果が返ります。捕捉すべき例外ではなく、そのまま検査できる値です。2 つ目のタブは、次の節で説明する `evaluateFormulaText` を使い、初期データを入れたワークブックで評価します。

<FormulaEvalDemo />

## 読み込み済みワークブックに対する評価 {#evaluating-against-a-loaded-workbook}

単発評価は、空の新規ワークブックの `Sheet1!A1` を基準に実行します。そのため、どのセル参照も空白を読み、`ROW()` と `COLUMN()` は `1` を返します。既存ワークブックのセルや定義名を使う場合は、ワークブックを読み込んで `evaluateFormulaText`（条件付き書式版は `evaluateConditionalFormula`）を呼び出してください。どちらも指定したセルに入力したかのように数式を評価し、ワークブックの内容は変更しません。

::: warning 読み取り専用、かつスカラーのみ
`evaluateFormulaText` / `evaluateConditionalFormula` はワークブックを変更せず、依存グラフにも参加しません。自己参照は `#REF!` を出さず、対象セルのキャッシュ済みの値をそのまま読みます。配列やスピルの結果からは、左上の要素だけを返します。これはスカラー評価 API の動作であり、Excel の暗黙的交差やスピルの挙動ではありません。スピルの実際の挙動は [動的配列](/ja/workbook/dynamic-arrays) を参照してください。
:::

::: tip 配列全体を返す `evaluateFormulaArray`
スピルした結果全体が必要な場合は `evaluateFormulaArray(sheet, row, col, formula)` を使います。戻り値は `{ status, rows, cols, cells }` の形の `EvalArrayResult` で、各値は `cells[r][c]` に入ります。スカラーの結果は 1×1 の配列として返ります。Python の `evaluate_formula_array(...)` は同じ内容を、`Value` の行のリストとして返します。
:::

### JavaScript / WASM と Native Node

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const workbook = Module.Workbook.loadBytes(xlsxBytes)

try {
  if (!workbook.isValid()) {
    throw new Error(Module.lastErrorMessage())
  }

  // シート 0、行 5、列 1（B6）に `=B4*1.1` を入力したかのように評価する。
  // 何も書き込まず、ワークブックの実際のセルを参照して解決する。
  const preview = workbook.evaluateFormulaText(0, 5, 1, '=B4*1.1')
  if (!preview.status.ok) {
    throw new Error(preview.status.message)
  }

  if (preview.value.kind === ValueKind.Number) {
    console.log(preview.value.number)
  }
} finally {
  workbook.delete()
}
```

Native Node パッケージ（`packages/npm-native`）も、同じ `Workbook` 形状で `evaluateFormulaText` / `evaluateConditionalFormula` を提供します。詳細は [Native Node 連携](/ja/runtimes/node-native) を参照してください。

::: warning Python で利用できる評価 API
Python には一般的なスカラーの `evaluate_formula_text` 相当はありません。一方、条件付き書式の述語には `evaluate_cf_formula`、完全な配列結果には `evaluate_formula_array` を使えます。ワークブックの文脈で一般的なスカラーを評価する場合は、`set_formula` でセルに書き込んで `recalc()` を呼んでください。
:::
