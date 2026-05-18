# パッケージと実行環境

| 入口 | パッケージ | 実行環境 |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | ブラウザ、worker、Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API アドオン |
| Python | `formulon` | wasmtime を使う py3 wheel |
| CLI | `formulon-cli-<os>-<arch>` | 単体バイナリ |
| C ABI | ヘッダとネイティブライブラリ | 独自ホスト向け |
| MCP | `@libraz/formulon-mcp` | エージェント向け stdio MCP サーバー |
| UI | `@libraz/formulon-cell` | ブラウザ向けスプレッドシート UI（ベータ版） |

すべての入口は同じ計算コアを呼び出します。違いはパッケージやホスト言語の都合であり、数式の意味が変わるべきではありません。

```mermaid
flowchart TB
  CORE[C++17 計算コア]
  ABI[C ABI<br/>ヘッダ + ネイティブライブラリ]
  CORE --> ABI
  ABI --> WASM[WASM<br/>@libraz/formulon]
  ABI --> NN[Native Node<br/>@libraz/formulon-native]
  ABI --> PY[Python<br/>formulon]
  ABI --> CLI[CLI<br/>formulon-cli-os-arch]
  WASM --> CELL[formulon-cell<br/>UI, ベータ版]
  WASM --> MCP[formulon-mcp<br/>stdio エージェントサーバー]
```

::: info 用語: 利用入口
共有された C++17 計算コアを、各ホスト環境から呼び出すためのパッケージ境界です。WASM、Python、CLI などは、直接または間接に C ABI 経由で同じコアを呼びます。入口ごとに変わるのはホスト言語、メモリ所有権、入出力の形であり、数式の意味は変わりません。
:::

## 入口ごとの成熟度

| 入口 | 成熟度 | 補足 |
| --- | --- | --- |
| WASM | 最も広い JS API | `formulon.d.ts`、ブラウザ / Node 対応 |
| Python | 安定した部分集合 | wasmtime で動くラッパー、context manager 対応 |
| CLI | 用途を絞ったツール | `eval` / `recalc` / `dump` |
| Native Node | 最小構成 | ネイティブ実行向け。WASM との API 対応はまだ限定的 |
| C ABI | 低レベル API 境界 | 各パッケージが呼び出す共通インタフェース |
| MCP | エージェント向け入口 | WASM の上に乗る。許可リストに基づいて呼び出す |
| `formulon-cell` | ベータ版 UI | WASM エンジンのブラウザ UI 例 |

## 入口ごとの結果が食い違ったとき

同じワークブック・同じプロファイルで 2 つの入口が異なる値を返したら、不具合か、文書化された互換性差分として扱います。`make parity-test` の整合性テストは、共有の検証用ワークブックを利用可能な全実行環境で評価し、*未ビルド* と *不一致* を分けて報告します。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ JavaScript API
- [Python API](/ja/api/python) ─ トップレベルラッパー
- [CLI リファレンス](/ja/api/cli) ─ コマンド API
- [実行環境を選ぶ](/ja/start/choose-runtime) ─ 判断ガイド
