# 数式カバレッジ

このページは、Formulon が認識する Excel 関数名の一覧と、各関数をローカルで評価できるかどうかを説明します。内部的には、実行時レジストリの `RegistryCatalog.CoverageReport` と、`tools/catalog/function_status.tsv` の対応状況注記に基づきます。

::: warning 認識対象は「ローカルで実行できる関数」と同じではありません
522 という数は、Formulon が名前を認識する Excel 関数の数です。この中には `COPILOT`、`PY`、`IMAGE`、`RTD`、`STOCKHISTORY`、`WEBSERVICE`、翻訳関数、CUBE 接続関数のように、Excel 側では外部サービスやホスト固有の状態へ処理を委ねる関数も含まれます。これらは意図的に名前を認識しますが、ローカル実装済みではありません。
:::

## 概要

Formulon は **522** 件の Excel 関数名を認識します。**507 件の実装（環境依存の `CELL`、`INFO` を含む）と、15 件の未提供スタブ**に分かれます。

| 状態 | 件数 | 意味 |
| --- | ---: | --- |
| 実装済み | 507 | ローカルで評価する。`CELL`、`INFO` の結果はワークブック / ホスト状態に依存する |
| 外部サービススタブ | 15 | 名前と引数数は認識するが、必要な外部サービスが Formulon の外にあるため、決定的な Excel エラーを返す |
| **認識対象の合計** | **522** | |

<DiagramLayers :layers="[
  { title: '522 件の認識対象関数名', nodes: [
    { label: '507 件が実装済み', note: 'CELL, INFO を含む' },
    { label: '15 件が外部サービススタブ', note: 'サービス / 接続に依存' }
  ] }
]" />

この範囲が、Formulon の互換性を説明するうえでの前提です。Formulon は広い範囲の数式をローカルで評価しますが、Microsoft 365 のクラウドサービス、クラウド Python 実行環境、HTTP クライアント、OLAP キューブ接続、RTD COM プロバイダー、Copilot を内蔵しているわけではありません。

下のパネルは、同じレジストリを実行時に読み出します。一覧は `functionNames()`、引数の数・対応状況・シグネチャは `functionMetadata(name, locale)` から取得しており、対応状況ごとの件数もページ側に持たずエンジンから数え直しています。上の表が全体として示している内容を、関数 1 件ごとに確認できます。「試す」欄では呼び出しをその場で評価できるので、名前は認識するがローカル実装ではない関数が実際に何を返すのかを、後述の表から推測せずに確かめられます。

<FunctionLookupDemo />

## カテゴリ別の認識対象

| カテゴリ | 認識対象 | 注記 |
| --- | ---: | --- |
| 数学 / 三角 | 81 | ローカル実装 |
| 統計 | 149 | ローカル実装 |
| 論理 | 20 | ローカル実装 |
| テキスト | 50 | ローカル実装 |
| 日付 / 時刻 | 25 | ローカル実装 |
| 検索 / 参照 | 39 | 動的配列対応の検索挙動を含むローカル実装。`IMAGE` と `RTD` は外部サービススタブ |
| 財務 | 56 | `STOCKHISTORY` は外部サービススタブ |
| エンジニアリング | 54 | ローカル実装 |
| 情報 | 19 | 環境依存の `CELL` と `INFO` を含む。このカテゴリに外部サービススタブはない |
| データベース | 12 | ローカル実装 |
| Web | 4 | `ENCODEURL` と `FILTERXML` は実装済み。`WEBSERVICE` と `PY` は外部サービススタブ |
| キューブ | 7 | 接続関数として名前は認識するが、ライブ OLAP 接続は Formulon の対象外 |
| 2024 / 2025 追加関数 | 6 | `COPILOT`、`TRANSLATE`、`DETECTLANGUAGE` などの外部サービススタブを含む |

## ワークブック単位の Oracle 検証トラック

数式レベルの Oracle 検証はセル値を確認します。ピボットテーブルや印刷レイアウトは、挙動が数式の結果ではなくワークブック構造として保存されているため、ワークブック単位の Oracle 検証トラックが別途必要です。

このトラックは、信頼できる PivotTable 自動化に Windows Excel COM が必要なため、`win-365-ja_JP` をプライマリプロファイルとして使います。pivot suite は `28/28` でクローズ済み、`print_basic` / `print_pagination` / `print_fit` / `print_matrix` は `formulon_workbook_oracle_tests` で `35/41` pass です。残る `6` 件は、`PageSetup.Zoom <= 50` で発生する既知の Excel PageBreakPreview COM の quirk による `win-365-ja_JP` scope の divergence skip として記録しています。

どちらの数値も、**チェックイン済みの履歴 golden** に対する結果です。この golden は Office 2019 または版不明のもので、reference-only として保持しています。製品版 Windows Microsoft 365 ホストでの再取得は未了のため、いずれの数値も Microsoft 365 での検証には当たりません。このプロファイルの `wanted` が何を意味するかは[ロケールプロファイル](./locale-profiles.md)を参照してください。

## 外部サービススタブ

次の関数名は意図的に認識します。未知関数として処理するのではなく、予測可能な Excel 風のエラーに落とすためです。いずれも Formulon がローカル計算として扱う範囲の外にあります。

| 関数 | ローカル実装ではない理由 | Formulon の挙動 |
| --- | --- | --- |
| `COPILOT` | Microsoft 365 Copilot / LLM サービスが必要 | 固定の利用不可エラー |
| `PY` | Microsoft 365 のクラウド Python 実行環境が必要 | 固定の利用不可エラー |
| `IMAGE` | 画像取得と描画を行うホスト機能が必要 | 固定の利用不可エラー |
| `RTD` | 外部の Real-Time-Data プロバイダーが必要 | 固定の利用不可エラー |
| `STOCKHISTORY` | Microsoft の市場データサービスまたはネットワーク I/O が必要 | 固定の利用不可エラー |
| `WEBSERVICE` | HTTP / ネットワーク I/O が必要 | 固定の利用不可エラー |
| `TRANSLATE`, `DETECTLANGUAGE` | クラウド翻訳 / 言語判定サービスが必要 | 固定の利用不可エラー |
| `CUBEKPIMEMBER`, `CUBEMEMBER`, `CUBEMEMBERPROPERTY`, `CUBERANKEDMEMBER`, `CUBESET`, `CUBESETCOUNT`, `CUBEVALUE` | ライブ OLAP キューブ接続が必要 | 固定の利用不可エラー |

## 実務上の確認

既存ワークブックでは、関数カバレッジを最初の確認項目として扱ってください。最終的な判断には、業務上重要な数式群ごとに小さな検証ファイルを作り、対象の Excel プロファイルと結果を比較します。

```sh
formulon dump --formulas workbook.xlsx > formulas.txt
```

## 一次情報源

認識対象の一覧は `tools/catalog/functions.txt` にあります。対応状況の注記は `tools/catalog/function_status.tsv` にあり、そこに載っていない項目はローカル実装として扱います。実行時レジストリのテストは「認識対象の名前が実行時に解決できること」を検証しますが、その数をローカル実装数と取り違えないように、対応状況ファイルで分類しています。
