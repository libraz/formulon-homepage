# 実行入口を選ぶ

Formulon は同じ C++ コアを、ホストごとのパッケージとして提供しています。このドキュメントでは、ホストから見える API と配布形式の組を「実行入口」と呼びます。

::: info 同じエンジン、異なるホスト契約
実行入口によって、パッケージ構成、メモリの扱い、配置方法、ホスト側エラーの報告方法が決まります。数式の結果は共通のコアが計算します。完全な一致が必要な場合は、出荷する各実行入口で、同じエンジンのバージョン、プロファイル、ワークブックを使って確認してください。
:::

| 実行入口 | 向いている用途 | パッケージ |
| --- | --- | --- |
| WebAssembly | ブラウザ、ワーカー、Node サービス | `@libraz/formulon` |
| Native Node | `.node` アドオンをビルドして配置できる Node サービス | `packages/npm-native`（ソースから） |
| Python | ノートブック、バッチ、データ処理 | `formulon` |
| CLI | シェル、CI、ワークブック検査 | GitHub Releases |
| MCP | ワークブックを開いて編集・保存する AI エージェント | `@libraz/formulon-mcp` |
| C ABI | 独自ホストや追加バインディング | ソースからビルド |

まずは最も高レベルな実行入口を選び、既存のパッケージにないバインディングが必要な場合だけ C ABI を使います。

## 選び方

<DiagramLayers
  :layers="[
    {
      title: 'どこで動かすか',
      nodes: [
        { label: 'ブラウザ', note: '→ WASM（@libraz/formulon）' },
        { label: 'サーバー / バッチ', note: '→ 次の質問: 言語は?' },
        { label: 'シェル / CI', note: '→ CLI（GitHub Releases）' },
        { label: 'エージェント / LLM', note: '→ MCP サーバー（formulon-mcp）' }
      ]
    },
    {
      title: 'サーバー / バッチ: 言語は?',
      nodes: [
        { label: 'Python', note: '→ Python（formulon）' },
        { label: 'Node', note: '→ 次の質問: Native Node をインストール可能か?' },
        { label: 'その他', note: '→ C ABI（ソースからビルド）' }
      ]
    },
    {
      title: 'Node: Native Node をインストール可能か?',
      nodes: [
        { label: '可能', note: '→ Native Node（packages/npm-native）' },
        { label: '不可', note: '→ WASM（@libraz/formulon）' }
      ]
    }
  ]"
  label="実行入口の選び方"
/>

| 要件 | 推奨する実行入口 |
| --- | --- |
| ブラウザアップロード / ローカルプレビュー / ワーカー再計算 | WASM |
| Native Node のインストールを前提にしない Node サービス | WASM |
| 大きなワークブックを扱い、ネイティブ配置が可能な Node サービス | Native Node |
| バッチジョブ / ノートブック | Python |
| CI のワークブックスナップショット | CLI |
| AI エージェントによるワークブック編集 | MCP |
| 新しい言語バインディング | C ABI |
