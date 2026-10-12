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

互換性は主張ではなく測定で示します。計算結果は実際の Excel 365 から取得した値（Oracle データ）と照合し、既知の差分は理由と最後に確認した Excel ビルドとともに `tests/divergence.yaml` に記録しています。新しいワークブックは、別のプロファイルを選ばない限り `win-365-en_US` の挙動で計算します。浮動小数点の誤差から和暦まで、具体的なケースを Excel の取得値とその場で照合した例を[互換性をどこまで詰めているか](/ja/compatibility/edge-cases)にまとめています。

## 解決すること

- サービス、ジョブ、ノートブックで `.xlsx` / `.xlsb` を再計算する。
- ブラウザやワーカー内で Excel の数式を評価する。
- 特定のロケールの Excel と同じ結果を得る（Mac と Windows の 14 ロケールに対応する 28 個のプロファイル）。
- ブラウザ、Python、CLI、Native Node、MCP で同じ計算コアを使い、結果の差を抑える。
- 計算値を更新しつつ、対応するワークブック構造を保持する。
- バージョン管理された Oracle データで数式挙動を検証する。
- 入力を検証する MCP ツールを通じて、AI エージェントがワークブックを編集する。ファイルへのアクセス権限はホスト側で制御する。

## やらないこと

Formulon は、表計算 UI、チャート描画、VBA 実行環境、Power Query、DAX、旧 `.xls` 実装ではありません。この境界により、計算エンジンを小さく検証しやすく保ちます。

## 現在の状態

Formulon は 1.0 より前の段階で、API とパッケージ構成は安定版まで変わる可能性があります。認識する関数名 526 件のうち 511 件はローカルで実行します。`COPILOT`、`PY`、`WEBSERVICE` など外部サービスが必要な関数は名前を認識しますが、Microsoft 365 のサービスは呼び出さず、固定のエラーを返します。業務上重要なワークブックは、対象 Excel プロファイルに対する検証ファイルで確認してください。
