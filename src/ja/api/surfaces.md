# パッケージと実行入口

| 実行入口 | パッケージ | 実行環境 |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | ブラウザ、ワーカー、Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API アドオン。npm には公開していないため、ソースからビルドします（[Native Node](/ja/runtimes/node-native)）。リリース CI は darwin-arm64、linux-x64、linux-arm64 向けにビルドします |
| Python | `formulon` | `wasmtime` で動く `py3-none-any` wheel |
| CLI | GitHub Releases の `formulon-<version>-<os>-<arch>.tar.gz` | 単体の `formulon` バイナリ。darwin-arm64、linux-x64、linux-arm64 向け |
| C ABI | `src/c_api/formulon_c.h` と `formulon_static`（または共有ライブラリの `formulon`） | 独自ホスト向け。ソースからビルドします |
| MCP | `@libraz/formulon-mcp` | エージェント向け stdio MCP サーバー |
| 表計算 UI | `@libraz/formulon-cell` | ブラウザ向け表計算 UI キット |

すべての実行入口は同じ計算コアを呼び出します。違いはパッケージ構成、ホスト言語、メモリ所有権と、[後述のメソッド差分](#method-differences)です。

<DiagramLayers label="C++17 計算コア -> C ABI -> WASM / Native Node / Python / CLI、WASM -> formulon-cell と formulon-mcp" :layers="[
  { title: 'コア', nodes: ['C++17 計算コア'] },
  { title: 'C ABI', nodes: ['formulon_c.h + コアライブラリ'] },
  { title: '実行入口', nodes: [
      'WASM (@libraz/formulon)',
      'Native Node (packages/npm-native)',
      'Python (formulon)',
      'CLI (formulon)'
    ]
  },
  { title: 'WASM の上に構築', nodes: ['formulon-cell (UI キット)', 'formulon-mcp (stdio エージェントサーバー)'] }
]" />

`formulon-cell` と `formulon-mcp` は C ABI に直接接続せず、WASM パッケージの上に構築されています。ブラウザや Node から `@libraz/formulon` を使う場合と同じ経路で計算コアに到達します。

::: info 用語: 実行入口
共有する C++17 計算コアを各ホスト環境から呼び出すためのパッケージ境界です。WASM、Python、CLI などは、直接または間接に C ABI 経由で同じコアを呼びます。ホスト言語、メモリ所有権、入出力の形、文書化された互換性の境界は実行入口ごとに異なる場合がありますが、共通の数式挙動は共有コアが定めます。
:::

## 実行入口ごとの成熟度

| 実行入口 | 成熟度 | 補足 |
| --- | --- | --- |
| WASM | 最も広い JS API | 生成された `formulon.d.ts`。ブラウザ、ワーカー、Node 対応 |
| Python | 広いワークブック API | `wasmtime` で動くラッパー。`with` ブロックを抜けるとワークブックを解放 |
| CLI | 用途を絞ったツール | `eval` / `recalc` / `dump` / `paginate` |
| Native Node | WASM と同じメソッド構成のネイティブバイナリ | 戻り値の形と値の意味は WASM と同じ。違いは下表のとおり |
| C ABI | 低レベル API 境界 | 他の実行入口が包んでいるすべての関数 |
| MCP | エージェント向け API | WASM の上に構築し、許可リストに基づいて呼び出す |
| `formulon-cell` | UI キット | TypeScript、React、Vue から埋め込める表計算 UI |

## メソッド差分 {#method-differences}

3 つのライブラリ用バインディングは、ワークブックモデル、ジオメトリ、テーマとスタイル、型付き AutoFilter、入力規則、コメント、画像、ピボットテーブル、印刷設定、プロファイル関連のヘルパーを共通で持ちます。違いがあるのは次の項目です。

| 機能 | WASM | Native Node | Python |
| --- | --- | --- | --- |
| ワークブックの解放 | `delete()` | `dispose()`（GC による最終化は予備） | `close()` または `with` ブロック |
| メモリ使用量の推定 | — | `memoryUsage()` | `memory_usage()` |
| 並列再計算 | `recalcParallel()`。ワーカーを使うのは `@libraz/formulon/threads` だけ | `recalcParallel()` | — |
| スカラーの読み取り専用評価 | `evaluateFormulaText()` | `evaluateFormulaText()` | —（`evaluate_formula_array()` を使う） |
| 反復計算の進捗コールバック | `setIterativeProgress()` | `setIterativeProgress()` | — |
| ログの受け取り先 | `setLogSink()` | `setLogSink()` | —（`set_log_min_level()` のみ） |
| テーブルの作成 | `createTable()` / `updateTable()` / `removeTable()` | — | `table_create()` / `table_update()` / `table_remove()` |
| シートの AutoFilter XML | `getSheetAutoFilterXml()` / `setSheetAutoFilterXml()` | — | `get_auto_filter_xml()` / `set_auto_filter_xml()` |
| 名前付きスタイルの XF レコード | `addCellStyleXf()` | — | `add_cell_style_xf()` |
| スタイルの一括登録、有効化だけの反復切り替え | — | — | `add_batch()`、`set_iterative_enabled()` |

CLI が公開するのは一部だけです。並列再計算の `--threads`、`--iterative`、4 つのサブコマンドがあります。

## 実行入口ごとの結果が食い違ったとき

同じワークブック・同じプロファイルで 2 つの実行入口が異なる値を返したら、不具合か、文書化された互換性差分として扱います。リポジトリの `make parity-test` は、CLI、npm の WASM パッケージ、Python wheel で共有の検証用ワークブックを評価し、ビルドされていないチャネルと値の不一致を分けて報告します。その他の違いはネイティブスレッド、コピーコスト、WASM のメモリ上限などの運用面です。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ JavaScript API
- [Python API](/ja/api/python) ─ トップレベルラッパー
- [CLI リファレンス](/ja/api/cli) ─ コマンド API
- [実行入口を選ぶ](/ja/start/choose-runtime) ─ 判断ガイド
