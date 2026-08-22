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
      { label: 'Python (formulon)', note: '配列 / CF 評価、コメント、ページ分割に対応' },
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
| Python | 広い workbook API | wasmtime で動くラッパー、context manager 対応 |
| CLI | 用途を絞ったツール | `eval` / `recalc` / `dump` / `paginate` |
| Native Node | 共有計算 API | 共有 Workbook メソッドを N-API アドオンで公開。ふりがな、反復設定の read-back、3 状態 visibility、印刷設定、range XF、cache-index pivot item も対応。table 作成、AutoFilter XML、cell-style 作成は WASM のみ |
| C ABI | 低レベル API 境界 | 各パッケージが呼び出す共通インタフェース |
| MCP | エージェント向け実行入口 | WASM の上に乗る。許可リストに基づいて呼び出す |
| `formulon-cell` | 参考 UI | 結合試験と実装例のための公開 UI。Excel 互換の完成 UI ではない |

::: info Python のパリティ境界
Python は配列全体の `evaluate_formula_array()`、条件付き書式の `evaluate_cf_formula()`、ふりがなテキストの取得・設定、コメント列挙（`comment_count()` / `get_comments()`）、`paginate()`、反復設定の read-back、3 状態 sheet visibility、typed print settings、range XF、cache-index pivot item を含む、ワークブックの広い範囲を同等に扱います。明示的な非公開項目は、一般的なスカラーの `evaluate_formula_text()` と反復進捗コールバックです。Python が C ABI のすべてのエントリーポイントをそのまま公開するわけではありません。
:::

Python は visual conditional-format payload、DXF、pivot report layout、pivot-cache worksheet-source access も公開し、data validation の `allow_blank` 省略時は `False` を使います。

## 実行入口ごとの結果が食い違ったとき

同じワークブック・同じプロファイルで 2 つの実行入口が異なる値を返したら、不具合か、文書化された互換性差分として扱います。`make parity-test` の整合性テストは、共有の検証用ワークブックを利用可能な全チャネルで評価し、*未ビルド* と *不一致* を分けて報告します。Native Node と WASM の共有計算メソッドは同じ result envelope と値の意味を持ち、残るメソッド差分は上記の WASM 限定 authoring 群だけです。その他の違いは native thread、コピーコスト、WASM メモリ上限などの運用面です。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ JavaScript API
- [Python API](/ja/api/python) ─ トップレベルラッパー
- [CLI リファレンス](/ja/api/cli) ─ コマンド API
- [実行入口を選ぶ](/ja/start/choose-runtime) ─ 判断ガイド
