# パッケージと実行入口

| 実行入口 | パッケージ | 実行環境 |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | ブラウザ、ワーカー、Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API アドオン。npm には未公開で、ソースを取得して配置先の OS / CPU アーキテクチャ用バイナリを配置します。リリース CI は darwin-arm64、linux-x64、linux-arm64 を対象にします。[Native Node](/ja/runtimes/node-native) を参照 |
| Python | `formulon` | wasmtime を使う py3 wheel |
| CLI | `formulon-cli-<os>-<arch>` | 単体バイナリ |
| C ABI | ヘッダとネイティブライブラリ | 独自ホスト向け |
| MCP | `@libraz/formulon-mcp` | エージェント向け stdio MCP サーバー |
| 表計算 UI | `@libraz/formulon-cell` | ブラウザ向け表計算 UI キット |

すべての API・パッケージは同じ計算コアを呼び出します。パッケージやホスト言語、メモリ所有権、入出力の扱いに加えて、文書化された互換性の境界も実行入口ごとに異なる場合があります。

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
  { title: 'WASM の上に構築', nodes: ['formulon-cell (UI キット)', 'formulon-mcp (stdio エージェントサーバー)'] }
]" />

`formulon-cell` と `formulon-mcp` は C ABI に直接接続せず、WASM パッケージの上に構築されています。ブラウザや Node から `@libraz/formulon` を使う場合と同じ経路で計算コアに到達します。

::: info 用語: 実行入口
共有する C++17 計算コアを各ホスト環境から呼び出すためのパッケージ境界です。WASM、Python、CLI などは、直接または間接に C ABI 経由で同じコアを呼びます。ホスト言語、メモリ所有権、入出力の形、文書化された互換性の境界は実行入口ごとに異なる場合がありますが、共通の数式挙動は共有コアが定めます。
:::

## 実行入口ごとの成熟度

| 実行入口 | 成熟度 | 補足 |
| --- | --- | --- |
| WASM | 最も広い JS API | `formulon.d.ts`、ブラウザ / Node 対応 |
| Python | 広いワークブック API | wasmtime で動くラッパー、コンテキストマネージャーによるライフタイム管理 |
| CLI | 用途を絞ったツール | `eval` / `recalc` / `dump` / `paginate` |
| Native Node | 共有計算 API | 共有 Workbook メソッドを N-API アドオンで公開。ふりがな、反復設定の読み取り、3 状態の表示状態、印刷設定、範囲 XF、キャッシュの共有項目インデックスによるピボット項目に対応。JavaScript バインディングでは、テーブル作成、AutoFilter XML、セルスタイル作成は WASM にのみあります |
| C ABI | 低レベル API 境界 | 各パッケージが呼び出す共通インターフェース |
| MCP | エージェント向け API | WASM の上に構築し、許可リストに基づいて呼び出す |
| `formulon-cell` | UI キット | TypeScript、React、Vue から埋め込める表計算 UI |

::: info Python のパリティ境界
Python は配列全体の `evaluate_formula_array()`、条件付き書式の `evaluate_cf_formula()`、ふりがなテキストの取得・設定、コメント列挙（`comment_count()` / `get_comments()`）、`paginate()`、反復設定の読み取り、3 状態のシート表示、型付き印刷設定、範囲 XF、キャッシュの共有項目インデックスによるピボット項目に対応し、ワークブックの広い範囲を同等に扱います。明示的な非公開項目は、一般的なスカラーの `evaluate_formula_text()` と反復進捗コールバックです。Python が C ABI のすべてのエントリーポイントをそのまま公開するわけではありません。
:::

Python は条件付き書式の表示データ、DXF、ピボットのレポートレイアウト、ピボットキャッシュのワークシート参照も公開し、入力規則で `allow_blank` を省略した場合は `False` を使います。

## 実行入口ごとの結果が食い違ったとき

同じワークブック・同じプロファイルで 2 つの API・パッケージが異なる値を返したら、不具合か、文書化された互換性差分として扱います。`make parity-test` の整合性テストは、共有の検証用ワークブックを利用可能な全チャネルで評価し、*未ビルド* と *不一致* を分けて報告します。Native Node と WASM の共有計算メソッドは同じステータス付きの戻り値と値の形式を持ち、残るメソッド差分は上記の WASM 専用の作成機能だけです。その他の違いはネイティブスレッド、コピーコスト、WASM のメモリ上限などの運用面です。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ JavaScript API
- [Python API](/ja/api/python) ─ トップレベルラッパー
- [CLI リファレンス](/ja/api/cli) ─ コマンド API
- [実行入口を選ぶ](/ja/start/choose-runtime) ─ 判断ガイド
