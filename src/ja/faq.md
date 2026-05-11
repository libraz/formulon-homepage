# FAQ

## エンジンと互換性

### Excel 本体が必要ですか？

実行時には不要です。Formulon は Excel・COM・Microsoft ランタイムを起動しません。Excel はテスト用の *oracle data*（参照値）をオフラインで取得するためだけに使います。本番計算はすべて Formulon 内部で完結します。

### 既定の互換性プロファイルは？

`win-365-ja_JP`（Windows 版 Excel 365、日本語ロケール相当）です。oracle データが揃ったプロファイルだけが公開されます。詳しくは [ロケールプロファイル](/ja/compatibility/locale-profiles)。

### スプレッドシートを描画できますか？

いいえ。Formulon は計算と構造保持を担当し、表示は UI レイヤーの責務です。[`@libraz/formulon-cell`](/ja/cell/) は engine の上に乗る別パッケージ（beta UI ライブラリ）で、UI 統合のデモ役を担います。Formulon 本体はあくまで headless です。

### VBA は実行しますか？

いいえ。VBA プロジェクトは保存・読み込み往復で byte 単位で保持できますが、マクロは決して実行しません。マクロ側の状態に依存する計算は Excel と差分が出ます。

### 旧 `.xls`（BIFF / Excel 97-2003）は対応しますか？

対応しません。対応形式は modern OOXML（`.xlsx` / `.xlsm`）と binary `.xlsb` です。`.xls` は事前に `.xlsx` 変換してください。

### PowerQuery、DAX、slicer、ピボット計算は？

ピボットの **layout** は subset で保持しますが、PowerQuery / DAX / 外部接続は対象外です。slicer は構造のみ passthrough で挙動は再現しません。

### なぜ C++ core を 1 つにしているのですか？

ブラウザ・サーバー・Python・CLI 間で挙動がずれないようにするためです。各 binding は計算を再実装せず、同じ core を呼び出します。oracle fixture も surface に依らず同じ core を検査します。

## 実行環境とパッケージ

### どの runtime を選べばよい？

数式ではなくデプロイ要件で選びます。ブラウザ → WASM、バッチ / notebook → Python、native 配布可能な Node サービス → Native Node、shell / CI → CLI、新規言語 → C ABI。詳しくは [Surface の選択](/ja/start/choose-runtime)。

### Python wheel に Cython / NumPy / pybind11 は必要？

不要です。公開されている wheel は `py3-none-any` で、`formulon_capi.wasm` と pure Python ラッパーを同梱しています。実行時依存は `wasmtime` のみです。

### オフラインで動きますか？

動きます。すべての runtime はローカルで計算します。WASM ビルドは外部通信せず、CLI / Python はあなたが渡したワークブック bytes だけを読みます。

### macOS / Linux / Windows のサポートは？

- **WASM**: `SharedArrayBuffer` を備える主要ブラウザ、および Node 18+。
- **Python**: `wasmtime` の wheel が出る主要 OS（Linux / macOS / Windows）。
- **Native Node**: `(os, arch)` ターゲット別の prebuilt バイナリ。
- **CLI**: GitHub Releases から `(os, arch)` ごとの prebuilt バイナリ。

### engine のサイズは？

WASM ビルドにはサイズ予算（厳格）があります。ブラウザに乗る依存は測定したうえでしか追加しません。現在の数値は [Size budgets](/ja/development/size-budgets) を参照してください。

## ブラウザでのホスティング

### COOP/COEP ヘッダーはなぜ必要？

WASM engine が pthread worker を使うため `SharedArrayBuffer` が必要で、ブラウザは cross-origin isolated なページでのみ `SharedArrayBuffer` を公開します。これを宣言するのが以下のヘッダーです。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

これらが無いと、`formulon-cell` / `@libraz/formulon` は stub engine にフォールバックします。詳しくは [トラブルシュート](/ja/start/troubleshooting)。

::: info 用語: stub engine
`SharedArrayBuffer` が使えない環境で `formulon-cell` が切り替える最小限の in-memory engine。UI は動作し続けますが、数式評価・recalc・`.xlsx` 往復は no-op になります。実行時は `isUsingStub()` で判定できます。
:::

### Vite preview は通るのに本番でだけ壊れるのは？

ローカル Vite の dev / preview だけ COOP/COEP が通っていて、本番ホストが返していないケースが多発します。`localhost` ではなく、デプロイ先のオリジンでヘッダーを確認してください。

## セキュリティと運用

### engine が任意コードを実行することは？

ありません。数式は engine が評価し、ユーザー提供 bytecode を走らせる経路はありません。VBA は保持しますが実行しません。MCP server の低レベル `formulon_workbook_call` は allowlist 化された `Workbook` メソッドだけを dispatch します。

### メモリ上限は？

WASM ビルドは WASM heap と engine 内 scheduler の中で割り当てます。大規模ワークブックはセル数に比例してスケールします。組み込みのセル数上限はないため、本番ホストは独自にアップロード制限を設けてください。

### ライセンスは？

`formulon` / `formulon-cell` / `formulon-mcp` すべて Apache-2.0 です。ライセンス条文の範囲で使用・改変・再配布できます。

## AI / MCP

### `formulon-mcp` とは？

Formulon の workbook surface を AI エージェント（Claude Code、Claude Desktop、Codex CLI、stdio-MCP 対応クライアント全般）に公開する stdio MCP server です。`npx -y @libraz/formulon-mcp` で起動します。詳しくは [MCP](/ja/mcp/)。

### エージェントから任意コードを評価できる？

できません。MCP server は入力を検証し、allowlist 化されたメソッドだけを dispatch します。session は `sessionId` で分離され、低レベル `formulon_workbook_call` は allowlist 外を拒否します。

## ステータス

### 本番投入できますか？

pre-1.0 です。522 件の関数カタログは登録済み、ファイル形式層も実装されていますが、API / packaging は今後変わる可能性があります。業務上重要な用途では exact version を pin し、代表的なワークブック fixture を維持してください。
