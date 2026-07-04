# 数式を評価する

数式評価が役立つのは、アプリケーションがワークブック UI 全体を読み込まずにスプレッドシートの意味論だけを必要とする場面です。

::: info Excel エラーは値
`#DIV/0!`、`#VALUE!`、`#NAME?` はスプレッドシートの値として返ります。ホスト API の失敗は実行入口ごとのステータス envelope、例外、非ゼロ終了で扱います。
:::

<DiagramLayers
  :layers="[
    {
      title: '数式をどう評価するか',
      nodes: [
        { label: '使い捨ての単発評価', note: 'evalFormula / eval_formula — ワークブックの文脈なし' },
        { label: '読み込み済みワークブックに対するアドホック評価', note: 'evaluateFormulaText（v0.9.4）— 読み取り専用、JS/WASM と Native Node のみ' },
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

## CLI

```sh
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
```

Excel のセルエラーは値です。`=1/0` は `#DIV/0!` のようなエラー値として返り、プロセス / Python / JS の例外とは別に扱います。ホスト側の失敗（不正なワークブックのバイト列、ファイルが見つからないなど）は、実行入口ごとのエラー経路で報告されます。

## 読み込み済みワークブックに対する評価（v0.9.4）

ここまでの例はすべて、使い捨ての数式コンテキストで評価しています。ワークブックが存在しないため、セル参照、定義名、`ROW()` / `COLUMN()` は何も解決できません。Formulon 0.9.4 では `evaluateFormulaText`（および条件付き書式版の `evaluateConditionalFormula`）が追加され、**読み込み済みの** ワークブックの特定のセルに入力したかのように数式テキストを評価できます。ワークブックの内容は一切変更しません。

::: warning 読み取り専用、かつスカラーのみ
`evaluateFormulaText` / `evaluateConditionalFormula` はワークブックを変更せず、依存グラフにも参加しません。自己参照は `#REF!` を出さず、対象セルのキャッシュ済みの値をそのまま読みます。配列やスピルの結果は左上端の要素だけに縮約されます。これは Excel の暗黙的交差やスピルの挙動ではなく、意図的な Phase 1 の API 仕様です。スピルの実際の挙動は [動的配列](/ja/workbook/dynamic-arrays) を参照してください。
:::

::: tip v0.9.5: 配列全体を返す `evaluateFormulaArray`
左上端への縮約を避けたい場合は、v0.9.5 で追加された `evaluateFormulaArray`（Python は `evaluate_formula_array`）を使います。同じ読み取り専用・非変更・自己参照の制約のもとで、動的配列 / スピル数式の結果を左上端に縮約せず、配列全体（`EvalArrayResult`）として返します。スカラー版の `evaluateFormulaText` / `evaluateConditionalFormula` とは違い、この配列版は Node アドオン・WASM・C API に加えて Python でも利用できます。
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

Native Node パッケージ（`packages/npm-native`）も、同じ `Workbook` 形状で `evaluateFormulaText` / `evaluateConditionalFormula` を提供します。詳細は [Native Node 統合](/ja/runtimes/node-native) を参照してください。

::: warning Python はスカラー版が未対応
`evaluateFormulaText` / `evaluateConditionalFormula`（スカラー版）は C API、Node アドオン、WASM でのみ利用でき、Python バインディングにはまだ相当する機能がありません。ただし全配列版の `evaluate_formula_array` は v0.9.5 で Python にも追加されています。スカラー評価でワークブックの文脈が必要な場合は、`formulon.eval_formula` で使い捨ての数式を評価するか、`set_formula` でセルに書き込んで `recalc()` を呼んでください。
:::
