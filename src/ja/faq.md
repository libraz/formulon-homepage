# FAQ

## エンジンと互換性

### Excel 本体が必要ですか？

実行時には不要です。Formulon は Excel、COM、Microsoft ランタイムを起動しません。Excel はテスト用の *Oracle データ*（参照値）をオフラインで取得するためだけに使います。本番計算はすべて Formulon 内部で完結します。

### 既定の互換性プロファイルは？

`win-365-ja_JP`（Windows 版 Excel 365、日本語ロケール相当）です。Oracle データが揃ったプロファイルだけが公開されます。詳しくは [ロケールプロファイル](/ja/compatibility/locale-profiles)。

### スプレッドシートを描画できますか？

いいえ。Formulon は計算と構造保持を担当し、表示は UI レイヤーの責務です。[`@libraz/formulon-cell`](/ja/cell/) はエンジンの上に乗る別パッケージ（ベータ版の UI ライブラリ）で、UI 統合の例を示します。Formulon 本体はあくまでヘッドレスです。

### VBA は実行しますか？

いいえ。VBA プロジェクトは保存・読み込み往復で byte 単位で保持できますが、マクロは決して実行しません。マクロ側の状態に依存する計算は Excel と差分が出ます。

### 旧 `.xls`（BIFF / Excel 97-2003）は対応しますか？

対応しません。対応形式は現代的な OOXML（`.xlsx` / `.xlsm`）とバイナリ形式の `.xlsb` です。`.xls` は事前に `.xlsx` へ変換してください。

### PowerQuery、DAX、slicer、ピボット計算は？

ピボットの **レイアウト** は一部のワークブックで保持しますが、PowerQuery、DAX、外部接続は対象外です。スライサーは構造のみ保持し、動作は再現しません。

### なぜ C++ core を 1 つにしているのですか？

ブラウザ、サーバー、Python、CLI 間で挙動がずれないようにするためです。各バインディングは計算を再実装せず、同じ中核エンジンを呼び出します。Oracle 検証データも、利用面にかかわらず同じ中核エンジンを検査します。

## 実行環境とパッケージ

### どの runtime を選べばよい？

数式ではなくデプロイ要件で選びます。ブラウザなら WebAssembly、バッチやノートブックなら Python、ネイティブ配布が可能な Node サービスなら Native Node、シェルや CI なら CLI、新しい言語バインディングなら C ABI が入口です。詳しくは [実行環境を選ぶ](/ja/start/choose-runtime)。

### Python wheel に Cython / NumPy / pybind11 は必要？

不要です。公開されている wheel は `py3-none-any` で、`formulon_capi.wasm` と純 Python ラッパーを同梱しています。実行時依存は `wasmtime` のみです。

### オフラインで動きますか？

動きます。すべての実行環境はローカルで計算します。WebAssembly ビルドは外部通信せず、CLI / Python は渡されたワークブックのバイト列だけを読みます。

### macOS / Linux / Windows のサポートは？

- **WASM**: `SharedArrayBuffer` を備える主要ブラウザ、および Node 18+。
- **Python**: `wasmtime` の wheel が出る主要 OS（Linux / macOS / Windows）。
- **Native Node**: OS と CPU アーキテクチャ別のビルド済みバイナリ。
- **CLI**: GitHub Releases から OS と CPU アーキテクチャごとのビルド済みバイナリ。

### engine のサイズは？

WebAssembly ビルドには厳格なサイズ予算があります。ブラウザに乗る依存は、測定したうえでしか追加しません。現在の数値は [サイズ予算](/ja/development/size-budgets) を参照してください。

## ブラウザでのホスティング

### COOP/COEP ヘッダーはなぜ必要？

WebAssembly エンジンが pthread ワーカーを使うため `SharedArrayBuffer` が必要です。ブラウザは cross-origin isolated なページでのみ `SharedArrayBuffer` を公開します。これを宣言するのが以下のヘッダーです。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

これらが無いと、`formulon-cell` / `@libraz/formulon` はスタブエンジンにフォールバックします。詳しくは [トラブルシュート](/ja/start/troubleshooting)。

::: info 用語: stub engine
`SharedArrayBuffer` が使えない環境で `formulon-cell` が切り替える、最小限のメモリ内エンジンです。UI は動作し続けますが、数式評価、再計算、`.xlsx` 往復保存は何もしない動作になります。実行時は `isUsingStub()` で判定できます。
:::

### Vite preview は通るのに本番でだけ壊れるのは？

ローカル Vite の開発サーバーやプレビューだけ COOP/COEP が通っていて、本番ホストが返していないケースがよくあります。`localhost` ではなく、デプロイ先のオリジンでヘッダーを確認してください。

## セキュリティと運用

### engine が任意コードを実行することは？

ありません。数式はエンジンが評価し、ユーザー提供のバイトコードを走らせる経路はありません。VBA は保持しますが実行しません。MCP サーバーの低レベル `formulon_workbook_call` は、許可リストに含まれる `Workbook` メソッドだけを呼び出します。

### メモリ上限は？

WebAssembly ビルドは WebAssembly ヒープとエンジン内スケジューラの中でメモリを割り当てます。大規模ワークブックはセル数に比例してスケールします。組み込みのセル数上限はないため、本番ホストは独自にアップロード制限を設けてください。

### ライセンスは？

`formulon` / `formulon-cell` / `formulon-mcp` すべて Apache-2.0 です。ライセンス条文の範囲で使用・改変・再配布できます。

## AI / MCP

### `formulon-mcp` とは？

Formulon のワークブック操作 API を AI エージェント（Claude Code、Claude Desktop、Codex CLI、stdio-MCP 対応クライアント全般）に公開する stdio MCP サーバーです。`npx -y @libraz/formulon-mcp` で起動します。詳しくは [MCP](/ja/mcp/)。

### エージェントから任意コードを評価できる？

できません。MCP サーバーは入力を検証し、許可リストに含まれるメソッドだけを呼び出します。セッションは `sessionId` で分離され、低レベル `formulon_workbook_call` は許可リスト外を拒否します。

## ステータス

### 本番投入できますか？

pre-1.0 です。ローカル数式エンジンは広い範囲を扱いますが、外部サービス依存の関数は利用不可スタブとして明示しており、ファイル形式層もワークブック単位の検証が必要です。API とパッケージ構成は今後変わる可能性があります。業務上重要な用途では正確なバージョンを固定し、代表的なワークブック検証ファイルを維持してください。
