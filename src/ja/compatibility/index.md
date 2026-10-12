# 互換性

Formulon は互換性を、確認して再現できる性質として扱います。このセクションは、ワークブックの結果が Excel と違うとき、または実装済みの数式やファイル機能を理解したいときに読む場所です。

::: warning 互換性はワークブックごとに確認する
「Excel 互換」は、どのワークブックもあらゆる Excel ビルドと完全に一致するという意味ではありません。文書化されたプロファイル、実装済みの関数群、ファイル形式サポート、Oracle テストが、処理したいワークブックに合っているかを確認してください。
:::

Formulon が実際にどこまで Excel に合わせているかは、[互換性をどこまで詰めているか](/ja/compatibility/edge-cases)で確認できます。浮動小数点、日付、型変換、ロケール、スピルの各ケースを、Excel から取得した値とその場で照合しています。

## 確認すること

1. [数式カバレッジ](/ja/compatibility/formula-coverage) と数式を照合する。
2. [ファイル形式サポート](/ja/compatibility/file-format-support) でワークブック構造を確認する。
3. [ロケールプロファイル](/ja/compatibility/locale-profiles) を固定し、比較・並べ替え・検索が重要なら [テキスト照合](/ja/compatibility/text-collation) を確認する。
4. [エラーモデル](/ja/compatibility/errors) でセルエラーとホスト側エラーの扱いを確認する。

::: info 現在の状態
Formulon はまだ 1.0 未満です。認識する関数名 **526** 件のうち **511** 件が実装済み（環境依存の `CELL` と `INFO` を含む）、残り **15** 件が意図的な外部サービススタブです。API は今後も変わりうるため、結果が重要な場合はバージョンを固定し、検証用の小さなワークブックを用意してください。
:::

## 確認領域

| 領域 | 確認内容 |
| --- | --- |
| 数式関数 | ローカル実装数、外部サービススタブ、検証ガイダンスを [数式カバレッジ](/ja/compatibility/formula-coverage) で確認 |
| ファイル | 読み込み / 書き出し / 保持の境界を [ファイル形式サポート](/ja/compatibility/file-format-support) で確認 |
| ロケールと言語 | 28 個のプロファイル ID、ロケール情報、数式ローカライズ、実行時エディターリンクを [ロケールプロファイル](/ja/compatibility/locale-profiles) と [ワークブックの言語](/ja/workbook/language) で確認 |
| テキスト挙動 | Mac の実測照合、Windows のバイト順、関数ごとの強度を [テキスト照合](/ja/compatibility/text-collation) で確認 |
| エラー | `#VALUE!`、`#REF!`、パーサー失敗、ホスト例外の扱いを [エラーモデル](/ja/compatibility/errors) で確認 |
| 検証 | プロファイルごとに取得した Excel の値、受け入れ済み差分、関数カタログの検証完了チェックを [Oracle テスト](/ja/compatibility/oracle-testing) で確認 |
