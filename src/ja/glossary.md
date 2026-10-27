# 用語集

ワークブックのデータ、計算、エンジンを呼び出す仕組みに関する言葉をまとめています。初めて読む場合は [基本概念](/ja/start/concepts) から進めてください。

## パッケージと設定

| 用語 | 意味 | 詳細 |
| --- | --- | --- |
| ヘッドレス | 表計算アプリケーションの操作画面を使わずに動くこと | [Formulon を使う理由](/ja/why) |
| 実行環境（runtime） | ブラウザや Node プロセスなど、アプリケーションが動く環境 | [実行環境](/ja/runtimes/) |
| 実行入口（surface） | WASM、Python、CLI など、ホストから見える API と配布形式の組 | [実行入口を選ぶ](/ja/start/choose-runtime) |
| バインディング | 共通のコアをホスト言語から呼び出せるようにするコード | [バインディング](/ja/development/bindings) |
| Excel 互換性プロファイル | `mac-365-ja_JP` など、再現する Excel のプラットフォームと地域設定。実行時の設定で、ファイルには保存されません | [ロケールプロファイル](/ja/compatibility/locale-profiles) |
| UI ロケール | Cell の操作画面の言語。マウント後の言語変更はワークブックの計算プロファイルも連動して変更します | [言語切り替え](/ja/cell/language-switching) |
| UI プロファイル | `embedded`、`full` など、Cell の操作部品や機能を選ぶ設定 | [設定オプション](/ja/cell/options) |
| 数式の共通表記（invariant formula） | 表示言語に依存しない、英語の関数名と共通の区切り文字を使う保存用の数式 | [数式の言語](/ja/workbook/language) |

## セルと計算

| 用語 | 意味 | 詳細 |
| --- | --- | --- |
| ワークブックモデル | 読み込みや新規作成でメモリ上に保持される、シート・セル・数式・スタイル・計算状態 | [ライフサイクル](/ja/workbook/lifecycle) |
| A1 形式のアドレス | `Summary!B2` などのセル名や範囲名。API に数値で渡す番号は 0 から始まります | [基本概念](/ja/start/concepts) |
| キャッシュ値 | 数式の保存済みの計算結果。再計算するまで古い値のことがあります | [再計算](/ja/workbook/recalculation) |
| 表示文字列 | 値に表示形式を適用した文字列。元の値や数式の文字列とは別です | [表示とレイアウト](/ja/workbook/presentation) |
| 再計算待ちのセル（dirty cell） | 計算結果を更新する必要があるセル | [再計算](/ja/workbook/recalculation) |
| 参照元セル（precedents） | ある数式が読むセル。B1 が `=A1*2` の場合、A1 は B1 の参照元です | [依存関係の追跡](/ja/workbook/recalculation) |
| 参照先セル（dependents） | あるセルを読む数式セル。同じ例で、B1 は A1 の参照先です | [依存関係の追跡](/ja/workbook/recalculation) |
| 依存グラフ | 再計算が必要な数式と、その計算順序を決めるための関係を表したもの | [再計算](/ja/workbook/recalculation) |
| 揮発性関数 | `NOW`、`RAND` など、入力を編集していなくても再計算時に評価される関数 | [再計算](/ja/workbook/recalculation) |
| スピル／アンカー | 配列数式の出力範囲／その数式が入っているセル | [動的配列](/ja/workbook/dynamic-arrays) |
| 部分再計算 | 指定した出力セルとその計算に必要な数式を更新する処理。それ以外は再計算待ちのまま残ることがあります | [再計算](/ja/workbook/recalculation) |

## ファイルとツール

| 用語 | 意味 | 詳細 |
| --- | --- | --- |
| ラウンドトリップ | ファイルを読み込んで再び保存すること。機能の保持と、その描画・計算への対応は別です | [ファイル形式](/ja/workbook/file-formats) |
| パススルー | モデルで解釈せず、ファイルの一部をバイト列として保持すること | [ファイル形式](/ja/workbook/file-formats) |
| 損失診断 | 読み込みや書き込みで、未解釈・保留・破棄となった機能の報告 | [ファイル形式サポート](/ja/compatibility/file-format-support) |
| ピボットキャッシュ | ピボットテーブルが集計する保存済みの元レコードや項目。再計算だけでは元データから更新されません | [ピボットテーブル](/ja/workbook/pivots) |
| Oracle データ | 互換性を確認するために、実際の Excel から取得した正解データ | [Oracle テスト](/ja/compatibility/oracle-testing) |
| MCP セッション | ローカル MCP サーバーのメモリ上に開かれ、`sessionId` で指定するワークブック。保存操作でファイルへ書き出します | [MCP ワークフロー](/ja/mcp/workflow) |
| セッションの dirty フラグ | 最後に損失なく保存できた状態と異なる可能性を示すもの。セルの再計算待ちとは別の状態です | [MCP ワークフロー](/ja/mcp/workflow) |
