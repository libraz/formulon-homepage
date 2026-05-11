# セキュリティモデル

`formulon-mcp` は、エージェントに対して構造化された観測可能な workbook 操作を提供する設計です。保証は意図的に狭く、エージェントループに組み込んでもコード実行の経路にはならないようにしています。

::: info 用語: allowlist
server が呼び出してよい `Workbook` メソッド名のホワイトリスト。リスト外は入力形に関係なく dispatch 層で拒否されます。実体は `formulon-mcp` リポジトリの `src/sessions.ts` にあります。
:::

## server が **しないこと**

- 任意の JavaScript / TypeScript / Python / VBA を評価しない。数式評価は Formulon の C++17 engine 内で完結する。
- ユーザー供給のネイティブモジュールを読み込まない。ネイティブコードは engine 本体のみ。
- ネットワークソケットを開かない。transport は stdio で、HTTP サーバーもアウトバウンド fetcher も持たない。計算でネットワーク接続は不要。
- server 再起動をまたいで状態を保持しない。session はプロセスメモリ上のみ。

## プロセス境界

stdio MCP server は client の子プロセスとして動きます。OS のプロセス境界がセキュリティ境界です。

- server は client のファイルシステム権限を継承する。client を sandbox 化すれば server も sandbox 化される。
- client（およびそれを所有するエージェント）を kill すれば server も終了し、開いていた session はすべて消える。
- client が複数ある場合、それぞれ別プロセスの server が動く。session が跨ぐことはない。

## ファイルシステムアクセス

パスを引数に取るツール（`formulon_open_workbook`、`formulon_save_session`、パス直接の `formulon_get_cell` など）は、server プロセスから見えるパスに対して動きます。プロジェクト配下に閉じ込めたいなら、親プロセスの working directory を制限するか、sandbox 経由でエージェントを動かしてください。

::: tip エージェントの書き出しパス
読み取りだけで足りるワークフローでは、エージェントに「成果物は指定サブディレクトリに書く」「`outputPath` を省略して bytes で受け取る」よう指示するのが安全です。server 側に独自の書き出し制限はなく、ホストの責任です。
:::

## 入力のバリデーション

すべてのツール入力は engine に渡る前に JSON schema で検証されます。不正 payload は session に触れずに MCP エラー応答で戻ります。数値座標は範囲チェックされ、A1 参照はパースして解決不能なら拒否されます。

## 低レベルアクセスも allowlist

`formulon_workbook_call` は、専用ツール化されていない高度な機能のために用意されたエスケープハッチですが、それでも server ソース内で明示されたメソッドだけを dispatch します。例として:

- PivotTable / PivotCache の読み取り
- style / merge / comment / hyperlink / validation の accessor
- 条件付き書式の評価
- 依存関係グラフ照会（`precedents`、`dependents`）
- 関数メタデータと名前ヘルパ
- spill 情報

allowlist にないメソッド（広すぎる engine API を含む）は拒否されます。server の更新時に allowlist は見直されます。

## session の分離

- `sessionId` ごとに workbook インスタンス・依存関係グラフ・dirty 集合・再計算状態を別に持つ。
- session が互いのセルを読むことはできない。
- `formulon_close_workbook` は即座に engine 状態を解放。`formulon_list_sessions` で何が開いているか確認できる。

## VBA は保持するが実行しない

VBA を含むワークブックは round-trip 可能ですが、マクロは passthrough バイト列として保持されるだけで、コンパイルも解釈も実行もされません。

## 次に読むもの

- [ワークフロー](/ja/mcp/workflow) ─ セキュリティモデルが守る操作ループ
- [Tools](/ja/mcp/tools) ─ 各ツールの目的
