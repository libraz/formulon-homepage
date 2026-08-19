# ワークフロー

サーバーは **セッション指向** です。ワークブックを 1 度開き、`sessionId` に対して複数の操作を投げ、最後に保存して閉じます。これにより毎回ファイルを再パースする無駄が消え、数式評価の状態が一貫します。

::: info 用語: セッション
in-memory に開いたワークブックとエンジン状態の組です。`sessionId` 文字列をキーにします。セッション同士は分離されており、別ファイル同士が cache・dirty 集合・依存関係グラフを共有することはありません。
:::

<DiagramFlow steps="formulon_open_workbook → formulon_set_cells / sheet_operation など → formulon_recalc_session → formulon_get_range / get_cell → formulon_save_session → formulon_close_workbook" />

中央の 3 ステップ（変更・再計算・読み取り）は、保存して閉じるまで何度でも繰り返せます。

## 開く

```json
{
  "path": "input.xlsx",
  "sessionId": "work"
}
```

新規ワークブックを作りたい場合は `path` を省略すると、`Sheet1` だけを持つ既定ワークブックのセッションが返ります。既存ファイルを読む場合は、入力を完全に往復できると判断する前にレスポンスの `session.loadLosses` を確認してください。reader がデコードできなかった内容が報告されます。

## セルを変更する

```json
{
  "sessionId": "work",
  "mutations": [
    { "type": "number",  "a1": "Sheet1!A1", "value": 41 },
    { "type": "formula", "a1": "Sheet1!B1", "formula": "=A1+1" }
  ],
  "recalc": true
}
```

`recalc: true` で mutation batch の末尾に再計算を走らせます。複数の `set_cells` をまとめてから 1 回だけ recalc したい場合は `false` にします。

::: tip A1 か 0-based か、どちらかに揃える
各 mutation は `a1: "Sheet1!B2"` でも、`sheet` / `row` / `col` の整数（0-based）でも書けます。整数形は Formulon API と一致します。ワークフローごとにスタイルを統一すると、エージェント出力が読みやすくなります。
:::

## 読む

```json
{
  "sessionId": "work",
  "range": "Sheet1!A1:B1"
}
```

矩形の値を kind 付きで返します。1 セルだけ読みたい場合は `formulon_get_cell` を使います。

## 明示的に再計算する

`recalc: true` を付けずに mutation を投げた場合、依存セルを読む前に `formulon_recalc_session` を 1 回呼びます。

```json
{ "sessionId": "work" }
```

## 検索 / 置換

```json
{
  "sessionId": "work",
  "query": "budget",
  "target": "both",
  "matchCase": false
}
```

```json
{
  "sessionId": "work",
  "query": "budget",
  "replacement": "forecast",
  "target": "texts",
  "recalc": true
}
```

`target` は `texts` / `formulas` / `both`。数式参照のリファクタリングで、テキストセルを触らずに数式だけ書き換えたいときに有効です。

## 保存

```json
{
  "sessionId": "work",
  "outputPath": "output.xlsx"
}
```

`formulon_save_session` は常にディスクへ書き込みます。ファイル内容をそのまま返すことはありません。出力先が `.xlsb` なら XLSB コンテナ、それ以外の拡張子なら XLSX を使います。書き込みは同じディレクトリの一時ファイルと atomic rename を経由します。書き込み先は次のフォールバックチェーンで解決されます。

<DiagramFlow :steps="[
  { label: 'outputPath 引数', note: '明示的に指定した場合' },
  { label: 'session.outputPath', note: '直前の保存で設定された値' },
  { label: 'session.sourcePath', note: 'ワークブックを開いたときのパス' },
  { label: 'エラー', note: 'どれも設定されていない場合' }
]" />

レスポンスの `bytes` フィールドは **バイト数**（数値）であり、ファイルの内容そのものではありません。選択したコンテナの `format` と、writer が内容を削除・下位変換した場合の `losses` も返ります。ロスなしの往復と判断する前に `losses` を確認してください。`formulon_update_workbook` も同じ保存結果を返します。

::: warning `outputPath` を省略すると元のファイルを上書きする
既存の `path` から開いたセッションに対して `outputPath` を付けずに `formulon_save_session` を呼ぶと、確認なしに元のファイルを上書きします。`path` を指定せずに新規作成したセッションには `sourcePath` のフォールバック先がないため、`outputPath` を省略すると `outputPath is required for a new workbook session` というエラーになります。元のファイルを保護したい場合は、必ず明示的な `outputPath` を渡してください。
:::

## 閉じる

```json
{ "sessionId": "work" }
```

セッションのエンジン状態を即座に解放します。サーバープロセス終了でもセッションは破棄されますが、長時間のエージェント実行では明示的に閉じる方がコストが低く、見通しも良くなります。

## ワンショット便利系

エージェントが最終結果だけを必要とする場合のために、ループ全体を 1 回の呼び出しにまとめるツールも用意されています。

| ツール | 効果 |
| --- | --- |
| `formulon_eval_formula` | 使い捨てワークブックで数式評価 |
| `formulon_inspect_workbook` | 開く → 要約 → 閉じる。セッションは残さない |
| `formulon_update_workbook` | load / create → mutate → recalc → save。セッションは残さない |

同じワークブックを何度も読み直す必要がないときに使います。

## 次に読むもの

- [ツール一覧](/ja/mcp/tools) ─ カテゴリ別ツール一覧
- [セキュリティモデル](/ja/mcp/security) ─ 許可されること / されないこと
