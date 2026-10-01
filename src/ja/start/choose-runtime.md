# 実行入口を選ぶ

Formulon は同じ計算コアを複数の API・パッケージとして公開しています。

::: info 同じエンジン、異なるホスト契約
API・パッケージの選択は、パッケージ構成、メモリの扱い、配置方法、エラーの受け渡しに影響します。共通の計算コアを使うため、数式の計算結果を意図的に変えるための選択ではありません。実際の一致は、同じエンジン・プロファイル・ワークブックで各実行入口を検証して確認します。
:::

| 実行入口 | 向いている用途 | パッケージ |
| --- | --- | --- |
| WebAssembly | ブラウザ、ワーカー、Node サービス | `@libraz/formulon` |
| Native Node | `.node` アドオンをビルドして配置できる Node サービス | `packages/npm-native` |
| Python | ノートブック、バッチ、データ処理 | `formulon` |
| CLI | シェル、CI、ワークブック検査 | GitHub Releases |
| C ABI | 独自ホストや追加バインディング | ソースからビルド |

まずは最も高レベルな API・パッケージを選び、既存の選択肢で足りないバインディングが必要な場合だけ C ABI を使います。

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
| 新しい言語バインディング | C ABI |

すべての API・パッケージは同じエンジンを共有します。違いはパッケージ構成、メモリのライフタイム管理、ホスト側のエラー報告にあります。同じエンジン・プロファイル・ワークブックでの結果の一致は、各実行入口で検証してください。
