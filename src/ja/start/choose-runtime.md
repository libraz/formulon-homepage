# 実行環境を選ぶ

Formulon は同じ core を複数の実行環境向けパッケージから公開します。

::: info 同じエンジン、異なる実行環境
実行環境の選択は、パッケージング、メモリの扱い、配置方法、エラーの受け渡しに影響します。スプレッドシートの意味論を変えるための選択ではありません。
:::

| 利用面 | 向いている用途 | パッケージ |
| --- | --- | --- |
| WebAssembly | ブラウザ、worker、Node サービス | `@libraz/formulon` |
| Native Node | ネイティブアドオンを使える Node service | `@libraz/formulon-native` |
| Python | ノートブック、バッチ、データ処理 | `formulon` |
| CLI | シェル、CI、ワークブック検査 | GitHub Releases |
| C ABI | 独自ホストや追加バインディング | repository build |

まずは最も高レベルな利用面を選び、必要な場合だけ C ABI へ降ります。

## 選び方

```mermaid
flowchart TD
  Q1{どこで動かすか}
  Q1 -->|ブラウザ| WASM[WASM<br/>@libraz/formulon]
  Q1 -->|サーバ / バッチ| Q2{言語は}
  Q1 -->|シェル / CI| CLI[CLI<br/>GitHub Releases]
  Q1 -->|エージェント / LLM| MCP[MCP server<br/>formulon-mcp]
  Q2 -->|Python| PY[Python<br/>formulon]
  Q2 -->|Node| Q3{Native install 可}
  Q2 -->|その他| ABI[C ABI<br/>repository build]
  Q3 -->|可| NN[Native Node<br/>formulon-native]
  Q3 -->|不可| WASM
```

| 要件 | 推奨面 |
| --- | --- |
| ブラウザアップロード / ローカルプレビュー / worker 再計算 | WASM |
| Native install 前提のない Node service | WASM |
| 大きなワークブックを扱う Node service | Native Node |
| バッチジョブ / ノートブック | Python |
| CI のワークブックスナップショット | CLI |
| 新しい言語バインディング | C ABI |
