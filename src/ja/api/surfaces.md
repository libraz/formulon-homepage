# パッケージ面

| 利用面 | パッケージ | 実行環境 |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | ブラウザ、worker、Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API addon |
| Python | `formulon` | wasmtime を使う py3 wheel |
| CLI | `formulon-cli-<os>-<arch>` | 単体バイナリ |
| C ABI | ヘッダと native ライブラリ | 独自ホスト向け |
| MCP | `@libraz/formulon-mcp` | エージェント向け stdio MCP server |
| UI shell | `@libraz/formulon-cell` | ブラウザ向け spreadsheet UI（beta） |

すべての利用面は同じ計算 core を公開します。違いはパッケージング由来であり、意味論の違いであってはいけません。

```mermaid
flowchart TB
  CORE[C++17 計算 core]
  ABI[C ABI<br/>ヘッダ + native ライブラリ]
  CORE --> ABI
  ABI --> WASM[WASM<br/>@libraz/formulon]
  ABI --> NN[Native Node<br/>@libraz/formulon-native]
  ABI --> PY[Python<br/>formulon]
  ABI --> CLI[CLI<br/>formulon-cli-os-arch]
  WASM --> CELL[formulon-cell<br/>UI shell, beta]
  WASM --> MCP[formulon-mcp<br/>stdio エージェント server]
```

::: info 用語: surface
共有された C++17 engine の上に乗るパッケージング境界のこと。すべての surface は（直接または間接に）C ABI 経由で engine を呼びます。surface ごとに変わるのはホスト言語・メモリ所有権・IO スタイルで、数式の意味は変わりません。
:::

## surface ごとの成熟度

| 利用面 | 成熟度 | 補足 |
| --- | --- | --- |
| WASM | 最も広い JS API | `formulon.d.ts`、ブラウザ / Node 対応 |
| Python | 安定 subset | wasmtime-backed wrapper、context-manager lifecycle |
| CLI | 用途を絞ったツール | `eval` / `recalc` / `dump` |
| Native Node | MVP subset | native path。WASM との parity はまだ未完 |
| C ABI | binding contract | packaged surfaces の低レベル契約 |
| MCP | エージェント向け surface | WASM の上に乗る。allowlist dispatch |
| `formulon-cell` | beta UI | WASM engine のデモホスト |

## surface が食い違ったとき

同じワークブック・同じ profile で 2 つの surface が異なる値を返したら、不具合か、文書化された互換性差分として扱います。`make parity-test` の parity runner が共有 fixture を全 channel で評価し、*missing* と *mismatched* を分けて報告します。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ JavaScript surface
- [Python API](/ja/api/python) ─ トップレベル wrapper
- [CLI リファレンス](/ja/api/cli) ─ コマンド surface
- [Surface の選択](/ja/start/choose-runtime) ─ 判断ガイド
