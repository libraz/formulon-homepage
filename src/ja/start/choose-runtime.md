# 実行入口を選ぶ

Formulon は同じ C++ コアを、ホストごとのパッケージとして提供しています。このドキュメントでは、ホストから見える API と配布形式の組を「実行入口」と呼びます。

::: info 同じエンジン、異なるホスト契約
実行入口によって、パッケージ構成、メモリの扱い、配置方法、ホスト側エラーの報告方法が決まります。数式の結果は共通のコアが計算します。完全な一致が必要な場合は、出荷する各実行入口で、同じエンジンのバージョン、プロファイル、ワークブックを使って確認してください。
:::

| 実行入口 | 向いている用途 | パッケージ |
| --- | --- | --- |
| WebAssembly | ブラウザ、ワーカー、Node サービス | `@libraz/formulon` |
| Native Node | `.node` アドオンをビルドして配置できる Node サービス | `@libraz/formulon-native`（ソースからビルド、npm 未公開） |
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
        { label: 'ブラウザ', note: 'WASM（@libraz/formulon）' },
        { label: 'サーバー / バッチ', note: '下の言語で分岐する' },
        { label: 'シェル / CI', note: 'CLI（GitHub Releases）' },
        { label: 'エージェント / LLM', note: 'MCP（@libraz/formulon-mcp）' }
      ]
    },
    {
      title: 'サーバー / バッチ: 言語は?',
      nodes: [
        { label: 'Python', note: 'Python パッケージ（formulon）' },
        { label: 'Node', note: '下で Native Node か WASM を選ぶ' },
        { label: 'その他', note: 'C ABI（リポジトリからビルド）' }
      ]
    },
    {
      title: 'Node: .node アドオンをビルド・配置できるか',
      nodes: [
        { label: '@libraz/formulon-native', note: 'できる。npm 未公開、ソースからビルド' },
        { label: '@libraz/formulon', note: 'できない。WASM、ネイティブビルド不要' }
      ]
    }
  ]"
  label="選択ガイド。ブラウザは WASM、シェルと CI は CLI、エージェントは MCP を使う。サーバー / バッチは言語で選び、Node はネイティブアドオンをビルドできるかで Native Node か WASM を選ぶ"
  caption="Node サービスで Native Node を選ぶのは .node アドオンをビルドまたは配置できる場合だけで、それ以外は WASM で対応します。"
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
