# 数式カバレッジ

このページは、Formulon が認識する Excel 関数名の一覧と、各関数をローカルで評価できるかどうかを説明します。内部的には、実行時レジストリの `RegistryCatalog.CoverageReport` と、`tools/catalog/function_status.tsv` の対応状況注記に基づきます。

::: warning 認識対象は「ローカルで実行できる関数」と同じではありません
522 という数は、Formulon が名前を認識する Excel 関数の数です。この中には `COPILOT`、`PY`、`IMAGE`、`RTD`、`STOCKHISTORY`、`WEBSERVICE`、翻訳関数、CUBE 接続関数のように、Excel 側では外部サービスやホスト固有の状態へ処理を委ねる関数も含まれます。これらは意図的に名前を認識しますが、ローカル実装済みではありません。
:::

## 概要

Formulon は現在、**522** 件の Excel 関数名を認識対象にしています。v0.9.2 時点では、そのうち **505 / 522** 件が実際のローカルエンジン実装です。対応状況の全体は次のとおりです。

| 状態 | 件数 | 意味 |
| --- | ---: | --- |
| 実エンジン実装 | 505 | Formulon の計算エンジンがローカルで評価する |
| 環境依存 | 2 | 名前を認識し可能な範囲で実装するが、一部結果がワークブックやホスト状態に依存する（`CELL`、`INFO`） |
| 外部サービス / 接続スタブ | 15 | 名前と引数数は認識するが、必要な外部サービスが Formulon の外にあるため、決定的な Excel エラーを返す |

この範囲が、Formulon の互換性を説明するうえでの前提です。Formulon は広い範囲の数式をローカルで評価しますが、Microsoft 365 のクラウドサービス、クラウド Python 実行環境、HTTP クライアント、OLAP キューブ接続、RTD COM プロバイダー、Copilot を内蔵しているわけではありません。

v0.9.2 では、実装済み関数の境界ケースもいくつか Excel 由来の期待値に揃えました。数値リテラルは Excel と同じ 15 桁有効数字の解析面に寄せ、`ARRAYTOTEXT` はスカラーのエラー引数をそのまま伝播します。`PIVOTBY` の配置、`MAP` / `MAKEARRAY`、`FREQUENCY`、`WRAPROWS` / `WRAPCOLS`、`TRIMRANGE` の一部境界ケースも修正し、`PERCENTILE.EXC` は上限境界で最大値ではなく `#NUM!` を返します。

## カテゴリ別の認識対象

| カテゴリ | 認識対象 | 注記 |
| --- | ---: | --- |
| 数学 / 三角 | 81 | ローカル実装 |
| 統計 | 149 | ローカル実装 |
| 論理 | 20 | ローカル実装 |
| テキスト | 50 | ローカル実装 |
| 日付 / 時刻 | 25 | ローカル実装 |
| 検索 / 参照 | 39 | 動的配列時代の検索挙動を含むローカル実装 |
| 財務 | 56 | `STOCKHISTORY` は外部サービススタブ |
| エンジニアリング | 54 | ローカル実装 |
| 情報 | 19 | `CELL` と `INFO` は環境依存。`IMAGE`、`PY`、`RTD` などは外部サービススタブ |
| データベース | 12 | ローカル実装 |
| Web | 4 | `ENCODEURL` と `FILTERXML` は実装済み。`WEBSERVICE` と `PY` は外部サービススタブ |
| キューブ | 7 | 接続関数として名前は認識するが、ライブ OLAP 接続は Formulon の対象外 |
| 2024 / 2025 追加関数 | 6 | `COPILOT`、`TRANSLATE`、`DETECTLANGUAGE` などの外部サービススタブを含む |

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

## 正の情報源

認識対象の一覧は `tools/catalog/functions.txt` にあります。対応状況の注記は `tools/catalog/function_status.tsv` にあり、そこに載っていない項目はローカル実装として扱います。実行時レジストリのテストは「認識対象の名前が実行時に解決できること」を検証しますが、その数をローカル実装数と取り違えないように、対応状況ファイルで分類しています。
