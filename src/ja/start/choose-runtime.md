# 実行入口を選ぶ

Formulon は同じ core を複数の実行入口向けパッケージとして公開しています。

::: info 同じエンジン、異なるホスト契約
実行入口の選択は、パッケージング、メモリの扱い、配置方法、エラーの受け渡しに影響します。スプレッドシートの意味論を変えるための選択ではありません。
:::

| 実行入口 | 向いている用途 | パッケージ |
| --- | --- | --- |
| WebAssembly | ブラウザ、worker、Node サービス | `@libraz/formulon` |
| Native Node | `.node` アドオンをビルド / stage できる Node service | `packages/npm-native` |
| Python | ノートブック、バッチ、データ処理 | `formulon` |
| CLI | シェル、CI、ワークブック検査 | GitHub Releases |
| C ABI | 独自ホストや追加バインディング | repository build |

まずは最も高レベルな実行入口を選び、必要な場合だけ C ABI へ降ります。

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
        { label: 'Node', note: '→ 次の質問: Native install 可能か?' },
        { label: 'その他', note: '→ C ABI（repository build）' }
      ]
    },
    {
      title: 'Node: Native install 可能か?',
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
| ブラウザアップロード / ローカルプレビュー / worker 再計算 | WASM |
| Native install 前提のない Node service | WASM |
| 大きなワークブックを扱い、native デプロイが可能な Node service | Native Node |
| バッチジョブ / ノートブック | Python |
| CI のワークブックスナップショット | CLI |
| 新しい言語バインディング | C ABI |

すべての実行入口は同じエンジンを共有します。違いはパッケージング、メモリのライフタイム管理、ホスト側のエラー報告であるべきで、数式の意味論の違いであってはなりません。
