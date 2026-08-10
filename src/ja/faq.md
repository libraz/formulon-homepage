# FAQ

## エンジンと互換性

### Excel 本体は必要ですか？

実行時には不要です。Formulon は Excel、COM、Microsoft ランタイムを起動せず、ワークブックの読み込み、数式評価、再計算、保存を Formulon 内で行います。

Excel を使うのは、開発・検証時に *Oracle データ*（実 Excel が返した参照値）を取得するときです。Windows Excel ブリッジによるピボットテーブルと印刷ページ分割の検証もテスト用の仕組みであり、本番実行時の依存ではありません。

### 既定の互換性プロファイルは？

既定は `win-365-ja_JP` です。Windows 版 Excel 365 の日本語ロケール相当を主な基準にします。Mac Excel 365 ja-JP も Oracle データで追跡しますが、英語ロケールのプロファイルは、対応する Oracle データが揃うまで公開しません。詳しくは [ロケールプロファイル](/ja/compatibility/locale-profiles)。

### Excel 関数は何件使えますか？

Formulon は **522** 件の Excel 関数名を認識します。そのうち **507** 件が実装済みで、`CELL` / `INFO` の 2 件は環境依存です。残る 15 件は外部サービススタブです。

外部サービススタブには `COPILOT`、`PY`、`IMAGE`、`RTD`、`STOCKHISTORY`、`WEBSERVICE`、`TRANSLATE`、`DETECTLANGUAGE`、CUBE 関数群があります。名前と引数の形は認識しますが、ローカルでは実行しません。詳しくは [数式カバレッジ](/ja/compatibility/formula-coverage)。

### `COPILOT`、`PY`、`STOCKHISTORY`、`WEBSERVICE` は実行できますか？

できません。これらは Microsoft 365 のクラウドサービス、クラウド Python 実行環境、市場データサービス、HTTP 通信、OLAP 接続など、Formulon の外にある実行環境を必要とします。

Formulon がこれらの関数名を認識するのは、未知関数として見逃さず、予測可能な Excel 風のエラーに落とすためです。外部サービスを内蔵している、または代替サービスへ接続する、という意味ではありません。

### 数式の結果は Excel と完全に一致しますか？

Formulon は `win-365-ja_JP` などのプロファイルごとに、実 Excel から取得した Oracle データと突合します。ただし、すべてのワークブックについて無条件に同一結果を保証するものではありません。ロケール依存、揮発性関数、外部サービス依存、ファイル構造、Excel 側の未文書挙動は差分要因になります。

<DiagramFlow steps="Excel（参照実装） → 取得した Oracle データ → プロファイル（win-365-ja_JP） → divergence.yaml → Formulon の出力" label="互換性プロファイルの構築と検証の流れ" />

実 Excel を参照実装とし、その実測挙動を Oracle データとして取得します。それを `win-365-ja_JP` のような名前付きプロファイルにまとめ、参照実装との差分のうち許容するものは理由と最終確認済みの Excel ビルドとともに `divergence.yaml` に記録します。説明のつかない不一致として Formulon の出力に残すのではなく、明示的に管理する仕組みです。パイプライン全体は [Oracle テスト](/ja/compatibility/oracle-testing) を参照してください。

業務上重要なワークブックは、対象プロファイルと Formulon のバージョンを固定し、代表的な検証ファイルを持つ運用にしてください。

### Excel 全体をクローンしようとしているのですか？

いいえ。Formulon はヘッドレスな計算・ワークブック処理エンジンです。Excel のデスクトップ UI、チャートレンダラー、VBA 実行環境、PowerQuery、外部データ更新パイプライン、旧 `.xls` スタックを再実装するものではありません。

狙っている範囲はもっと狭く、現代的なワークブックファイルを読み込み、ローカルで評価できるスプレッドシート数式を計算し、可能な範囲でワークブック構造を保持し、同じコアを WASM、Python、CLI、Native Node、MCP から使えるようにすることです。

### Excel、LibreOffice、HyperFormula、クラウド表計算 API ではだめですか？

用途に合うならそれらを使うべきです。実 Excel、VBA、PowerQuery、ライブ接続、最終的な見た目確認が必要なら Excel が正解です。LibreOffice は広い office suite で、バッチ変換に向く場合があります。HyperFormula は、`.xlsx` ワークブックの往復保存よりも、組み込み用の数式エンジンが欲しい場合に向きます。クラウド表計算 API は、データがすでにそのサービスにある場合に便利です。

Formulon は別の場所を狙っています。デスクトップアプリを自動操作したり、ワークブックをホスト型表計算サービスへ送ったりせず、ローカルで組み込める `.xlsx` 計算とワークブック変更が必要なアプリケーション向けです。

### Excel 互換はそもそも無理では？

無限定の Excel 互換という主張は広すぎて実用的ではありません。Formulon はその言い方を避け、名前付きプロファイルを対象にし、実 Excel の結果を Oracle データとして記録し、許容する差分を明示します。

それでも難しい領域は残ります。揮発性関数、未文書の型変換、ロケール依存の書式、浮動小数点の境界、外部サービス、保持はするが意味評価はしないファイル機能などです。実際に動かす予定のワークブック群で検証してください。

### なぜ既定プロファイルが日本語 Excel なのですか？

最初にチェックインされた数式 Oracle データは Mac Excel 365 ja-JP で取得されました。`win-365-ja_JP` は実行時の既定プロファイルで、variant golden を通じて検証されています。ピボット / 印刷のワークブック単位 Oracle データでもプライマリプロファイルです。ロケールは実際の表計算挙動に影響します。関数名、区切り記号、日付パース、テキスト書式、照合、エラー表示などが変わり得ます。

英語ロケールのプロファイルは、対応する Oracle データが揃うまで公開しません。これはカバレッジ上の不足であり、日本語 Excel が世界中の Excel を代表するという主張ではありません。

## ファイル形式とワークブック機能

### 読み書きできるファイル形式は？

公開 API の通常の実行入口は `.xlsx` 形式のバイト列です。WASM、Python、Native Node、CLI、MCP の各実行入口は、基本的に `.xlsx` を読み込み、再計算し、`.xlsx` として保存する流れを提供します。

`.xlsb`（MS-XLSB）も読み書きできます。モデル化して出力するのはスタイル、行 / 列レイアウト、結合、`date1904`、view / zoom / frozen panes、動的配列メタデータ、対応する tokenized formula です。条件付き書式、入力規則、ハイパーリンク、auto-filter、印刷設定 / 改ページ、drawing / table 参照と relationship は worksheet tail として保持します。保持されることは編集・評価できることを意味しません。非対応数式はキャッシュ済みリテラルへ置き換える場合があり、`fm_workbook_save_xlsb_with_result` が件数を報告します。CLI と `saveEx` / `save_ex` は出力拡張子から形式を選び、入力は内容から判定します。

`.xlsm` / `.xltm` のようなマクロ付き OOXML パッケージは、`vbaProject.bin` をバイト列として保持するテストがあります。ただし、VBA は実行しません。旧 `.xls`（BIFF / Excel 97-2003）は対象外です。

### VBA は実行しますか？

実行しません。VBA プロジェクトは往復保存で保持できますが、マクロは一切実行しません。マクロがセル値やワークブックの状態を書き換える前提のワークブックでは、Excel と結果が変わる可能性があります。

### PowerQuery、DAX、外部接続は使えますか？

使えません。PowerQuery、DAX、ライブ外部接続、Web / OData / OLAP からのデータ更新は Formulon の対象外です。外部データを更新したい場合は、上流で Excel や別のデータ処理基盤を使い、更新後の `.xlsx` を Formulon に渡してください。

### ピボットテーブルは対応していますか？

ピボットキャッシュとピボットテーブルの構造保持、ピボット操作、レイアウト取得、pivot-cache の worksheet-source access は C API、Node addon、WASM、Python で使えます。外部データ接続を再実行してキャッシュを作り直す機能はありません。

一方で、PowerQuery や外部接続を再実行してピボットキャッシュを最新化する用途は対象外です。Excel の「データ更新」機能そのものを置き換えるものではありません。

### 印刷設定や改ページは保持できますか？

`.xlsx` のページ設定、余白、ヘッダー / フッター、印刷オプション、プリンター設定、改ページ関連のメタデータは往復保存の対象です。`paginate` API は両端を含む印刷範囲と改ページを解決しますが、最終描画は Excel や別の印刷エンジンで行います。

ただし、Formulon は印刷プレビュー UI や PDF レンダラーではありません。最終的なページ描画は Excel や別のレンダリング層で確認してください。

### スプレッドシート UI はありますか？

Formulon 本体はヘッドレスエンジンです。セルグリッドの表示や操作 UI は本体の責務ではありません。

ブラウザ UI の参考実装として [`@libraz/formulon-cell`](/ja/cell/) と各フレームワーク向けラッパーを公開しています。位置づけは結合試験用の参考 UI です。全機能を網羅した Excel 互換 UI ではなく、UI/UX も Excel に完全には寄せていません。UI 側のバグが残る可能性もあるため、完成品ではなくエンジン統合例として扱ってください。

### ユーザーがアップロードした任意の `.xlsx` を安全に処理できますか？

任意のスプレッドシートファイルを無害なものとして扱わないでください。Formulon は VBA、PowerQuery、外部接続、HTTP 経由の数式関数を実行しないため、よくある実行経路はいくつか消えます。それでも、複雑な ZIP / XML ワークブックデータをパースし、利用する実行入口によってはファイルを読み書きします。

信頼できないアップロードを扱う場合は、Formulon をサンドボックス化されたプロセスまたは worker で実行し、ファイルサイズと実行時間に上限を設け、ファイルシステムアクセスを制限し、パッケージバージョンを固定した上で更新してください。

### チャート、図形、画像、書式は再計算されますか？

書式や多くのワークブック構造は読み込み、書き出し、保持の対象になります。ただし、保持はレンダリングや意味評価と同じではありません。Formulon はチャートを描画せず、図形をレンダリングせず、印刷どおりの PDF を生成せず、`IMAGE` の画像取得も実行しません。

見た目の最終確認には Excel または別のレンダリング層を使ってください。Formulon は計算とワークブック変更のためのものです。

## 実行入口とパッケージ

### なぜコアは C++17 なのですか？

C++17 は、このプロジェクトでは保守的なポータビリティ選択です。Emscripten / WASM で安定して動き、npm、PyPI、CLI、ネイティブ組み込み向けの複数配布に耐え、GCC 9+ / Clang 10+ 程度までコンパイラ下限を広げられます。

実装では意図的に小さな C++ サブセットを使います。C ABI 境界、明示的なエラー値、限定的なテンプレート利用、抑えた inline、翻訳単位ごとのサイズ追跡です。これにより、対応する配布先ごとのコードサイズと生成物を読みやすく管理できます。作者の既存プロジェクト規約である C++17、`Expected<T, Error>`、例外 / RTTI なし、Google style も再利用しています。

### なぜ Rust ではないのですか？

トレードオフは承知の上です。Rust はこの問題の一部にとって妥当な言語ですし、メモリ安全性の議論にも意味があります。一方で Formulon は、OOXML パース、ZIP 処理、正規表現、数値変換、C ABI パッケージング、Emscripten、ネイティブ組み込みといった既存の C / C++ 資産の近くにあります。miniz、pugixml、PCRE2、double-conversion のようなライブラリを使うため、C++ のままの方が FFI 層を増やさずに済みます。

主な互換性リスクも、メモリ安全性だけではありません。難所は Excel の挙動です。型変換、エラー伝播、ロケール、日付、動的配列、OOXML 往復保存、Oracle 差分が中心です。Rust は多くの実装リスクに効きますが、表計算仕様の地獄は消してくれません。Formulon は現在の C++17 規約、C ABI 境界、formatter、Oracle / CTest gate を中心に組まれています。他の人に新規スプレッドシートエンジンを C++ で始めることを勧めるものではありません。

### どの実行入口を選べばよいですか？

配置先で選びます。

| 用途 | 推奨パッケージ |
| --- | --- |
| ブラウザ上で計算したい | `@libraz/formulon`（WASM） |
| ブラウザまたは native addon なしの Node.js | `@libraz/formulon`（WASM） |
| ソース checkout から Node.js ネイティブ実行を優先したい | `packages/npm-native` |
| Python バッチやノートブックで使いたい | `formulon`（PyPI） |
| CI やシェルから使いたい | GitHub Releases の CLI |
| AI エージェントにワークブック操作を渡したい | `@libraz/formulon-mcp` |

詳しくは [実行入口を選ぶ](/ja/start/choose-runtime)。

### Python wheel に Cython / NumPy / pybind11 は必要ですか？

不要です。`formulon` の wheel は `py3-none-any` で、`formulon_capi.wasm` と純 Python ラッパーを同梱します。実行時依存は `wasmtime` です。Python 3.9 以上が対象です。

### Native Node は WASM と同じ機能を全部使えますか？

Workbook の形は同じです。ソースツリーの `packages/npm-native` は WASM と同じ surface と 3 個の static factory（`createDefault` / `createEmpty` / `loadBytes`）を公開します。Native Node には決定的な `dispose()` と、セル・shared strings・passthrough part・ワークブックメタデータを含む推定値 `memoryUsage()` があり、V8 の external-memory 報告も更新します。GC はフォールバックです。WASM は `delete()` でネイティブハンドルを解放します。

ソースツリー内のパッケージをビルド / stage でき、配置先に platform-specific な `.node` バイナリを置けるなら Native Node を選べます。native thread や `loadBytes` / `save` の heap copy 削減を重視する用途向けです。ブラウザや native addon を置けない Node 配置では WASM を使います。

### オフラインで動きますか？

ローカル計算はオフラインで動きます。WASM、Python、Native Node、CLI は、渡された数式やワークブックのバイト列をローカルで処理します。

外部サービス関数（`WEBSERVICE`、`STOCKHISTORY`、`TRANSLATE`、`COPILOT` など）は、オフラインでもオンラインでも Formulon では実行しません。

### ワークブックデータはどこかに送信されますか？

コアエンジンはワークブックのバイト列をローカルで処理します。WASM、Python、Native Node、CLI の計算に Formulon 側のホストサービスは不要です。

ただし、ホストアプリケーションをそのように作れば、ファイルを外部に送ることはできます。MCP の運用も、エージェントに与えるクライアント権限とファイルシステム権限に依存します。

### ブラウザでは COOP / COEP ヘッダーが必要ですか？

WASM エンジンが pthread ワーカーを使うため、ブラウザでは `SharedArrayBuffer` が必要です。通常は次のヘッダーで cross-origin isolated にします。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

これらのヘッダーがない場合、`@libraz/formulon`（生の WASM パッケージ）にフォールバックはありません。`createFormulon()` はそのまま失敗します。`formulon-cell` の `WorkbookHandle.createDefault()` も、既定では `SharedArrayBuffer` が使えない環境で reject します。簡易エンジンは、ホスト側が `preferStub: true` を指定して明示的に選んだ場合にのみ動きます。実行時にどちらが動いているかは `wb.isStub` / `isUsingStub()` で判定でき、`createDefault()` の reject は `onError` または `try` / `catch` で処理してください。暗黙のフォールバックを前提にしないでください。

### Vite のビルド警告は問題ですか？

ブラウザ向け bundler では、`node:module` や `node:worker_threads` が externalized されたという警告が出ることがあります。`@libraz/formulon` の WASM factory には Node 実行用の分岐も含まれるためです。ブラウザ実行時には使われない分岐なので、多くの場合は警告だけで動作に影響しません。

ビルドが失敗する場合は、worker を ES module 形式にし、ビルド target を `es2022` 以上にしてください。詳しくは [トラブルシュート](/ja/start/troubleshooting)。

## 使いどころ

### どんな用途に向いていますか？

Excel ワークブックをアプリや業務フローの一部として扱う用途に向いています。たとえば、ブラウザ上の見積もり・料金計算、サーバー側の帳票計算、CI での計算差分検査、Python バッチ、AI エージェントによるワークブック編集です。

反対に、Excel そのものを置き換えるデスクトップ UI、VBA 実行環境、PowerQuery / DAX 実行基盤、外部データ接続の更新基盤として使うものではありません。用途別の詳しい紹介は [ユースケース](/ja/scenarios/) を参照してください。

### 速いですか？

スプレッドシートに対して、単一の正直なベンチマーク値はありません。実行時間は、ワークブック構造、数式の種類、動的配列、共有数式、ファイルサイズ、パース時間を測るのか、再計算を測るのか、保存時間を測るのか、ホスト言語のオーバーヘッドを含めるのかで変わります。

実用上の主張はアーキテクチャ上のものです。各実行入口は同じネイティブ C++ コアを共有し、WASM / Python / CLI / Native Node はそのコアを包む配布面です。レイテンシやコストを約束する前に、代表的なワークブックで測ってください。

### 本番投入できますか？

pre-1.0 です。ローカル数式エンジンは広い範囲を扱えますが、API とパッケージ構成は今後変わる可能性があります。業務上重要な用途では、Formulon のバージョン、対象プロファイル、代表ワークブックの検証データを固定してください。

本番で使いやすい領域は、入力ワークブックの形式と数式範囲を管理できるサーバー処理、CI、社内ツール、組み込み計算です。任意の Excel ファイルを完全互換で処理する汎用 Excel 代替としては扱わないでください。

### 実際の組み込みで壊れやすいのはどこですか？

よくある失敗は単純な四則演算ではありません。未対応の外部データ更新、マクロへの暗黙依存、ロケール依存のパース、揮発性関数、隠れたワークブック状態、未対応のファイル構造、保持された表示オブジェクトがレンダリングまたは再計算されたという思い込みです。

まず代表的なワークブックを少数用意し、数式をダンプし、対象 Excel プロファイルと出力を比較し、そのファイルを CI に入れてください。

### Microsoft Excel と法的に結びついていますか？

実行時に Microsoft のランタイム、サービス、SDK、製品ライセンスは必要ありません。Excel は開発時に Oracle データを取得するための参照実装として使います。

Excel は Microsoft の製品および商標です。Formulon は独立した Apache-2.0 プロジェクトであり、Microsoft Excel そのものでも、Microsoft が支援する実装でもありません。

## AI / MCP

### `formulon-mcp` とは？

`@libraz/formulon-mcp` は、Formulon のワークブック操作 API を stdio MCP サーバーとして公開するパッケージです。AI エージェントが `.xlsx` を開き、構造を調べ、セルやシートを編集し、再計算して保存するための 31 個のツールを提供します。Node.js 22 以上が必要です。

```sh
npx -y @libraz/formulon-mcp
```

詳しくは [MCP](/ja/mcp/)。

### エージェントから任意コードを実行できますか？

できません。MCP サーバーは入力を検証し、セッションを `sessionId` で分離します。低レベルの `formulon_workbook_call` も、`formulon-mcp` の `src/sessions.ts` にある allowlist に含まれる `Workbook` メソッドだけを呼び出します。

ただし、MCP はファイルを読み書きするツールです。運用時は、MCP クライアント側の権限、作業ディレクトリ、扱うファイルの範囲を制御してください。

## ライセンス

### ライセンスは？

`formulon`、`formulon-cell`、`formulon-mcp` は Apache-2.0 です。ライセンス条文の範囲で使用、改変、再配布できます。
