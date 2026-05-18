# インストール

`formulon-mcp` は npm に公開されており、`npx` 経由で改変なしに動きます。大半の MCP クライアントは 1 行の登録で済みます。

::: tip Node.js 22+ が必須
サーバーは Node 22 の機能を使います。それ以前のバージョンは起動に失敗します。`node --version` で確認してください。
:::

## Claude Code

```sh
claude mcp add --scope user formulon -- npx -y @libraz/formulon-mcp
```

確認:

```sh
claude mcp list
```

`formulon` が `✓ Connected` と表示されれば成功です。ログやトラブルシュートは [Claude Code 公式ドキュメント](https://docs.claude.com/en/docs/claude-code/mcp) を参照してください。

## Codex CLI

`~/.codex/config.toml` に以下を追加します。

```toml
[mcp_servers.formulon]
command = "npx"
args = ["-y", "@libraz/formulon-mcp"]
```

`codex` を再起動するとツール検出に出てきます。

## Claude Desktop

`claude_desktop_config.json` に `formulon` を追加します。OS ごとの場所は次のとおりです。

| OS | パス |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "formulon": {
      "command": "npx",
      "args": ["-y", "@libraz/formulon-mcp"]
    }
  }
}
```

Claude Desktop を再起動すると次のセッションからツールが使えるようになります。

## その他の stdio MCP クライアント

stdio 対応の MCP クライアントはすべて使えます。起動コマンドを次のいずれかに向けてください。

```sh
npx -y @libraz/formulon-mcp
```

グローバルインストール済みなら:

```sh
npm install -g @libraz/formulon-mcp
formulon-mcp
```

::: info 用語: stdio MCP server
クライアントが子プロセスとして起動し、stdin / stdout で JSON-RPC を話す長期実行プロセスです。プロセスのライフタイムはクライアントが所有し、親を終了すればサーバーも止まります。ポートは開きません。
:::

## ソースから

開発中の fork や特定 revision を固定する場合:

```sh
git clone https://github.com/libraz/formulon-mcp.git
cd formulon-mcp
yarn install
yarn run build
```

ビルド済み `dist/index.js` の絶対パスを登録します。

```sh
claude mcp add --scope user formulon node /absolute/path/to/formulon-mcp/dist/index.js
```

clone せずに最新 `main` を試すなら:

```sh
npx -y github:libraz/formulon-mcp
```

## 動作確認

接続済みクライアントから次の 2 ツールが使えれば疎通 OK です。

- `formulon_version` ─ ロード済み Formulon エンジンのバージョン
- `formulon_eval_formula` ─ 使い捨てワークブックで 1 つの数式を評価

低コストなスモークテストとして推奨です。

## 次に読むもの

- [ワークフロー](/ja/mcp/workflow) ─ open / mutate / recalc / save の流れ
- [ツール一覧](/ja/mcp/tools) ─ カテゴリ別のツール一覧
- [セキュリティモデル](/ja/mcp/security) ─ サーバーが許可すること / しないこと
