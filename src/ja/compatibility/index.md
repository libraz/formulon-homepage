# 互換性

Formulon は互換性を、確認して再現できる性質として扱います。このセクションは、ワークブックの結果が Excel と違うとき、または実装済みの数式やファイル機能を理解したいときに読む場所です。

::: warning 互換性はワークブックごとに確認する
「Excel-compatible」は、すべてのワークブックがすべての Excel build と完全一致するという意味ではありません。文書化された profile、実装済みの関数群、ファイル形式サポート、Excel 由来の期待値が、処理したいワークブックと合うかを確認してください。
:::

## 確認すること

1. [数式カバレッジ](/ja/compatibility/formula-coverage) と数式を照合する。
2. [ファイル形式サポート](/ja/compatibility/file-format-support) でワークブック構造を確認する。
3. [エラーモデル](/ja/compatibility/errors) でセルエラーとホスト側エラーの扱いを確認する。

::: info 現在の状態
Formulon はまだ pre-1.0 です。関数カタログはすべて登録済みですが、API は変わる可能性があり、ワークブック単位の Excel 互換性は検証ファイルによる確認が必要です。結果が重要な場合はバージョンを固定し、小さなワークブック検証ファイルを持ってください。
:::

## 確認領域

| 領域 | 確認先 |
| --- | --- |
| 数式関数 | [数式カバレッジ](/ja/compatibility/formula-coverage) |
| ファイル | [ファイル形式サポート](/ja/compatibility/file-format-support) |
| エラー | [エラーモデル](/ja/compatibility/errors) |
| 現在の状態 | Pre-1.0 API、全関数登録済み、検証ファイルによる確認を推奨 |
