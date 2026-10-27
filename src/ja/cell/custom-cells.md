---
title: セルの独自表示とホスト関数
description: instance.cells で条件に合うセルの表示を変え、数式の入力候補と instance.formula で使うホスト関数を登録します。
---

# セルの独自表示とホスト関数

セルのレジストリで描画文字列を変えても、数式・編集・保存に使う値は変わりません。ホスト関数のレジストリはアプリケーションコードから呼ぶ関数と数式の入力候補を提供しますが、ワークブックの再計算中に計算エンジンがそのコールバックを呼ぶことはありません。

```ts
import { Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'standard' },
  functions: [
    {
      name: 'TAX',
      impl: (amount) => (amount.kind === 'number' ? amount.value * 0.1 : null),
      meta: { description: '金額の 10% を返します。', args: ['amount'] },
    },
  ],
  seed: (wb) => {
    wb.setText({ sheet: 0, row: 0, col: 0 }, '注文')
    wb.setNumber({ sheet: 0, row: 1, col: 0 }, 42)
  },
})

// A 列の注文番号を INV-0042 の形で表示します。
const removeFormatter = instance.cells.registerFormatter({
  id: 'invoice-number',
  match: ({ addr, value }) => addr.sheet === 0 && addr.col === 0 && value.kind === 'number',
  format: ({ value }) =>
    value.kind === 'number' ? `INV-${String(value.value).padStart(4, '0')}` : null,
})

instance.formula.evaluate('TAX', [{ kind: 'number', value: 1000 }])
// { kind: 'number', value: 100 }
```

セル A2 の値は数値の `42` で、画面には `INV-0042` と表示されます。`TAX` は数式の入力候補に現れ、ホストのコードが `instance.formula.evaluate()` を呼んだときに実行されます。再計算中にエンジンが呼ぶことはありません。詳しくは [ホスト関数](#host-functions) を参照してください。

どちらのレジストリもマウントしたインスタンスごとに存在します。`instance.cells` は `CellRegistry`、`instance.formula` は `FormulaRegistry` です。React と Vue では、`onReady` または `ready` イベントで受け取ったインスタンスから使います。

## 表示フォーマッター

フォーマッターは、条件に合うセルに描画する文字列を差し替えます。文字列の描画は通常の処理のままなので、フォント、文字色、塗りつぶし、配置はセルの書式に従います。変わるのは描画される文字列だけです。セルの値、数式バー、セル内エディターは保存された値を使い、保存されるのもその値です。

`registerFormatter(entry)` には `CellFormatterEntry` を渡します。

| 項目 | 意味 |
| --- | --- |
| `id` | 固定の識別子。同じ `id` で登録し直すと、前の登録を置き換えます。 |
| `match(input)` | このセルで `format` を実行する場合に `true` を返します。 |
| `format(input)` | 描画する文字列を返します。`null` を返すと次のフォーマッターに回ります。 |
| `priority` | 値が小さいほど先に実行されます。既定値は `50` です。 |

どちらの関数も `CellRenderInput` を受け取ります。

| 項目 | 型 |
| --- | --- |
| `addr` | `{ sheet, row, col }`。いずれも 0 始まりです。 |
| `value` | `CellValue`。`blank`、`number`、`bool`、`text`、`error` のいずれかです。 |
| `formula` | 保存された数式の文字列、または `null`。 |
| `format` | セルの `CellFormat`、または `undefined`。 |

フォーマッターは優先度の順に実行され、最初に `null` 以外を返したものの結果が描画されます。どれも文字列を返さなければ、通常どおり表示形式に従った文字列が表示されます。フォーマッターの結果は表示形式の文字列より優先されるため、日付や通貨のセルに一致させると、その表示を置き換えます。

`registerFormatter()` はその登録を解除する関数を返します。`unregisterFormatter(id)` は識別子で解除し、登録があったかどうかを返します。登録済みの識別子は `formatterIds()` で取得できます。登録と解除のたびにグリッドが再描画されます。

`match` と `format` は、スクロールを含め再描画のたびに、描画するセルごとに呼ばれます。数回の比較で済む処理にとどめ、ホスト側のデータは事前に用意した `Map` から引いてください。コールバックの中で取得しにいくのは避けます。

```ts
const statusLabels = new Map([
  [1, '受付'],
  [2, '出荷済み'],
  [3, '完了'],
])

instance.cells.registerFormatter({
  id: 'order-status',
  priority: 10,
  match: ({ addr }) => addr.sheet === 0 && addr.col === 3 && addr.row > 0,
  format: ({ value }) =>
    value.kind === 'number' ? (statusLabels.get(value.value) ?? null) : null,
})
```

ラベルのないステータスコードでは `null` を返すため、そのセルは通常の表示に戻ります。

## ホスト関数 {#host-functions}

マウントオプションの `functions` は、`{ name, impl, meta }` の各項目を `instance.formula` に登録します。後から追加する場合は `register()` を使います。

```ts
const removeNet = instance.formula.register(
  'NET',
  (gross, rate) =>
    gross.kind === 'number' && rate.kind === 'number' ? gross.value / (1 + rate.value) : null,
  { description: '税込み金額から税を除きます。', args: ['gross', 'rate'], returnType: 'number' },
)
```

| メンバ | 動作 |
| --- | --- |
| `register(name, impl, meta?)` | 関数を追加または置き換えます。返り値の関数はこの登録だけを解除します。後の `register()` で同じ名前が置き換えられていた場合は何もしません。 |
| `unregister(name)` | 関数を削除し、登録があったかどうかを返します。 |
| `has(name)`、`get(name)` | 登録の有無を確認するか、`{ name, impl, meta }` を取得します。 |
| `list()` | 登録済みの名前を大文字にして並べ替えた配列。 |
| `evaluate(name, args)` | 関数を同期的に呼び、`CellValue` を返します。未登録の名前では例外を投げます。 |
| `subscribe(fn)`、`clear()` | 登録の変化を購読します。`clear()` はすべての関数を削除します。 |

名前は大文字と小文字を区別せず、大文字で保存されます。大文字にした後の名前は英字で始まり、英字、数字、`_` だけで構成されている必要があります。そうでなければ `register()` は例外を投げ、マウントも失敗します。

`impl` は `CellValue` の引数を受け取ります。返り値は `CellValue` でもプレーンな値でもよく、`evaluate()` が次のように変換します。数値は `number`、文字列は `text`、真偽値は `bool`、`null` は `blank` になります。

### 数式バーとエンジンへの反映

登録した名前は、`=` に続けて入力したときの数式の入力候補に表示されます。同じ文字で始まる組み込み関数より前に並びます。`meta`（`description`、`args`、`returnType`）は登録と一緒に保持され、`get()` で取得できます。入力候補と引数ヘルプには `args` のシグネチャが表示されます。

formulon エンジンにはユーザー定義関数を呼び出す仕組みがないため、再計算中に `impl` が呼ばれることはありません。`=TAX(A2)` のようなセルの数式を書いても、値はホスト関数から得られません。ホストのコードで値を計算し、結果をセルに書き込んでください。

```ts
instance.on('cellChange', ({ addr, value }) => {
  if (addr.sheet !== 0 || addr.col !== 1 || addr.row === 0) return
  const tax = instance.formula.evaluate('TAX', [value])
  instance.applyChanges([{ addr: { ...addr, col: 2 }, value: tax }], { history: 'record' })
})
```

このハンドラーは、B 列の値が変わるたびに C 列へ書き込みます。`history: 'record'` を指定すると、書き込みが Undo の履歴に残ります。既定の `'reset'` のままでは、編集のたびにユーザーの履歴が消えてしまいます。

### 新しいワークブックに初期値を入れる

`seed(wb)` は `WorkbookHandle` を受け取り、最初の描画の前に 1 回だけ実行されます。実行されるのはマウント時にワークブックを作成した場合だけで、`workbook` で渡したワークブックには適用されません。ロケールの計算プロファイルは選択済みなので、`seed` で入れた数式は最初の描画と同じ設定で計算されます。主にデモやテストで使います。

React と Vue でも `functions` と `seed` をプロパティとして渡せますが、読み込まれるのはコンポーネントのマウント時だけです。後から変更しても反映されないため、`instance.formula.register()` を使ってください。

## 関連ページ

- [API 一覧](/ja/cell/api) — インスタンスのメンバとイベント。
- [ホスト統合](/ja/cell/host-integration) — `applyChanges()`、保存の流れ、ホスト側のコールバック。
- [オプション](/ja/cell/options) — `autocomplete` を含む機能スイッチ。
- [React / Vue アダプター](/ja/cell/frameworks) — `functions` と `seed` のプロパティ。
