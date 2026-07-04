# パッケージと実行入口

| 実行入口 | パッケージ | 実行環境 |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | ブラウザ、worker、Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API アドオン。darwin-arm64 / linux-x64 / linux-arm64 向けのビルド済みバイナリを同梱（ソース checkout からのビルドも可） |
| Python | `formulon` | wasmtime を使う py3 wheel |
| CLI | `formulon-cli-<os>-<arch>` | 単体バイナリ |
| C ABI | ヘッダとネイティブライブラリ | 独自ホスト向け |
| MCP | `@libraz/formulon-mcp` | エージェント向け stdio MCP サーバー |
| 参考 UI | `@libraz/formulon-cell` | ブラウザ結合試験向け UI |

すべての実行入口は同じ計算コアを呼び出します。違いはパッケージやホスト言語の都合であり、数式の意味が変わるべきではありません。

<DiagramLayers label="C++17 計算コア -> C ABI -> WASM / Native Node / Python / CLI、WASM -> formulon-cell と formulon-mcp" :layers="[
  { title: 'コア', nodes: ['C++17 計算コア'] },
  { title: 'C ABI', nodes: ['ヘッダ + ネイティブライブラリ'] },
  { title: '実行入口', nodes: [
      'WASM (@libraz/formulon)',
      'Native Node (packages/npm-native)',
      { label: 'Python (formulon)', note: 'スカラーのアドホック評価・コメント列挙は未対応（0.9.5 で配列全体を返す evaluate_formula_array は対応）' },
      'CLI (formulon-cli-<os>-<arch>)'
    ]
  },
  { title: 'WASM の上に構築', nodes: ['formulon-cell (参考 UI)', 'formulon-mcp (stdio エージェントサーバー)'] }
]" />

`formulon-cell` と `formulon-mcp` はどちらも C ABI に直接乗るのではなく、WASM パッケージの上に構築されています。ブラウザや Node から `@libraz/formulon` を使う場合と同じ経路で計算コアに到達します。

::: info 用語: 実行入口
共有された C++17 計算コアを、各ホスト環境から呼び出すためのパッケージ境界です。WASM、Python、CLI などは、直接または間接に C ABI 経由で同じコアを呼びます。実行入口ごとに変わるのはホスト言語、メモリ所有権、入出力の形であり、数式の意味は変わりません。
:::

## 実行入口ごとの成熟度

| 実行入口 | 成熟度 | 補足 |
| --- | --- | --- |
| WASM | 最も広い JS API | `formulon.d.ts`、ブラウザ / Node 対応 |
| Python | 広い workbook API だが、最新の追加機能では WASM / Node に遅れている | wasmtime で動くラッパー、context manager 対応 |
| CLI | 用途を絞ったツール | `eval` / `recalc` / `dump` |
| Native Node | WASM 型の API | WASM と同じ Workbook surface を N-API アドオンで公開 |
| C ABI | 低レベル API 境界 | 各パッケージが呼び出す共通インタフェース |
| MCP | エージェント向け実行入口 | WASM の上に乗る。許可リストに基づいて呼び出す |
| `formulon-cell` | 参考 UI | 結合試験と実装例のための公開 UI。Excel 互換の完成 UI ではない |

::: warning Python は 0.9.4 の追加機能にまだ対応していません
読み取り専用の**スカラー**アドホック評価 `evaluateFormulaText` / `evaluateConditionalFormula` と、シート単位のコメント列挙は C API・Native Node アドオン・WASM だけが持つ機能です。Python の `Workbook` にはこれに相当する評価メソッドがなく、コメントも単一セル向けの `get_comment` / `set_comment` しかありません — Native Node の `getComments(sheet)` や C API の `fm_sheet_get_comment_count` / `fm_sheet_get_comment_at_index` に相当する列挙 API は存在しません。なお 0.9.5 で Python にも、配列全体を返すアドホック評価 `evaluate_formula_array` と、関数メタデータをマージする `merge_function_metadata` が追加されました（スカラーの `evaluate_formula_text` / `evaluate_conditional_formula` は引き続き未対応）。Python の `add_conditional_format` は、他の実行入口と同様に新規ルールのインデックスを返します。
:::

## 実行入口ごとの結果が食い違ったとき

同じワークブック・同じプロファイルで 2 つの実行入口が異なる値を返したら、不具合か、文書化された互換性差分として扱います。`make parity-test` の整合性テストは、共有の検証用ワークブックを利用可能な全チャネルで評価し、*未ビルド* と *不一致* を分けて報告します。Native Node と WASM は同じ result envelope と Workbook method shape を持つ前提です。違いは native thread、コピーコスト、WASM メモリ上限などの運用面です。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ JavaScript API
- [Python API](/ja/api/python) ─ トップレベルラッパー
- [CLI リファレンス](/ja/api/cli) ─ コマンド API
- [実行入口を選ぶ](/ja/start/choose-runtime) ─ 判断ガイド
