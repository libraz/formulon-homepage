# Formulon が必要な理由

Formulon は、Excel を組み込まずにスプレッドシート計算を実行したい製品のためのヘッドレス計算エンジンです。1 つの C++17 計算コアを、WebAssembly、Python、CLI、ネイティブ組み込み、そして [`@libraz/formulon-mcp`](/ja/mcp/) を通じた AI エージェントから利用できるようにパッケージ化しています。

<DiagramLayers :layers="[
  { title: 'コア', nodes: ['1 つの C++17 計算エンジン'] },
  { title: 'パッケージ', nodes: [
    { label: '@libraz/formulon', note: 'WASM・ブラウザ / Node' },
    { label: 'packages/npm-native', note: 'Native Node アドオン' },
    { label: 'formulon（PyPI）', note: 'Python' },
    { label: 'CLI', note: 'シェル / CI' },
    { label: '@libraz/formulon-mcp', note: 'AI エージェント' }
  ] }
]" label="1 つの C++17 コアを WASM、Native Node、Python、CLI、MCP としてパッケージ化" />

互換性は測定可能なものとして扱います。既定プロファイルは `win-365-ja_JP` で、実際の Excel から取得した Oracle データにより挙動を固定します。曖昧な「Excel 風」ではなく、確認できる期待値にもとづいて差分を管理します。

## 解決すること

- サービス、ジョブ、ノートブックで `.xlsx` / `.xlsb` を再計算する。
- ブラウザやワーカー内で Excel の数式を評価する。
- ブラウザ、Python、CLI、Native Node、MCP で同じ計算コアを使い、結果の差を抑える。
- 計算値を更新しつつ、対応するワークブック構造を保持する。
- バージョン管理された Oracle データで数式挙動を検証する。
- 入力を検証する MCP ツールを通じて、AI エージェントがワークブックを編集する。ファイルへのアクセス権限はホスト側で制御する。

## やらないこと

Formulon は、表計算 UI、チャート描画、VBA 実行環境、Power Query、DAX、旧 `.xls` 実装ではありません。この境界により、計算エンジンを小さく検証しやすく保ちます。

## 現在の状態

Formulon は開発中で、まだ安定版ではありません。数式エンジンは広い範囲をローカルで評価しますが、`COPILOT`、`PY`、`WEBSERVICE` など、外部サービスが必要な関数は実行できません。API とパッケージ構成は安定版まで変わる可能性があります。業務上重要なワークブックは、対象 Excel プロファイルに対する検証ファイルで確認してください。
