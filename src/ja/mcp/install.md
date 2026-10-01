---
description: stdio サーバーの登録、最初の計算、クライアント起動時の問題を確認します。
---

# formulon-mcp のインストール

npm パッケージ `@libraz/formulon-mcp` は stdio MCP サーバーとして動きます。[`engines` の要件](https://github.com/libraz/formulon-mcp/blob/main/package.json)を満たす Node.js（22 以上）を用意してください。通常の利用ではリポジトリの取得は不要です。

## 対話式セットアップ

ターミナルで同梱のインストーラーを実行します。

```sh
npx -y @libraz/formulon-mcp init
```

対象の番号をカンマ区切りで指定します。空欄なら Claude Code のユーザースコープを選びます。

| 対象 | 設定ファイル |
| --- | --- |
| Claude Code — ユーザー | `~/.claude.json` |
| Claude Code — プロジェクト | 現在のディレクトリの `.mcp.json` |
| Codex CLI | `~/.codex/config.toml` |
| Claude Desktop — macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop — Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop — Linux | `~/.config/Claude/claude_desktop_config.json` |

インストーラーはファイルの新規作成、既存設定への追加、既存の `formulon` エントリの置き換えを表示して、書き込み前に確認します。他のサーバー設定は保持します。プロジェクトスコープではプロジェクトのルートで実行してください。登録後はクライアントを再起動します。

登録を削除するには次を実行します。

```sh
npx -y @libraz/formulon-mcp uninstall
```

削除メニューの既定値は 4 種類すべてのクライアントです。選択した設定ファイルから `formulon` のエントリを削除します。Node.js や他の MCP サーバーは削除しません。

## 手動での登録

JSON 設定を使うクライアントでは、既存の `mcpServers` オブジェクトに次のエントリを追加します。

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

Codex CLI 用にインストーラーが書き込む TOML セクションは次のとおりです。

```toml
[mcp_servers.formulon]
command = "npx"
args = ["-y", "@libraz/formulon-mcp"]
```

他の stdio クライアントでも同じコマンドと引数を使います。GUI クライアントから `node` と `npx` が見つかることを確認してください。ターミナルと PATH が異なる場合は実行ファイルを絶対パスで指定します。

## 最初の計算

接続したエージェントに次のように依頼します。

> Formulon でサーバーとエンジンのバージョンを確認し、`=SUM(10,20,30)` を計算してください。

エージェントは `formulon_version` に `{}`、`formulon_eval_formula` に次の入力を渡します。

```json
{ "formula": "=SUM(10,20,30)" }
```

数式の応答には `kind: "number"`、`value: 60` の `value` オブジェクトが含まれます。ファイルパスや永続的なセッションは不要です。ファイルを編集する手順は[ワークブックのワークフロー](/ja/mcp/workflow)を参照してください。

## 未公開のコードを使う場合

バージョンを指定しない `npx` コマンドは npm に公開済みのパッケージを実行します。公開前のローカルコードを使うには、チェックアウトをビルドしてエントリポイントの絶対パスを登録します。

```sh
cd /absolute/path/to/formulon-mcp
yarn install
yarn run build
```

```json
{
  "mcpServers": {
    "formulon": {
      "command": "node",
      "args": ["/absolute/path/to/formulon-mcp/dist/index.js"]
    }
  }
}
```

依存するエンジンパッケージが取得できる必要があります。サイトにリリース予定の仕様が載っていても、`npx` が取得するパッケージは変わりません。

## トラブルシュート

| 症状 | 確認すること |
| --- | --- |
| サーバーが起動しない | Node.js、`npx`、クライアントの PATH、サーバーログを確認します。 |
| ターミナルでコマンドが待ち続ける | `init` なしで実行すると stdio 接続を開始し、MCP クライアントを待ちます。 |
| 登録後もツールが出ない | クライアントを再起動し、選択した設定ファイルを読み込んだか確認します。 |
| ワークブックを開けない | サーバーから見える絶対パスとファイル権限を確認します。 |
| セッション ID が見つからない | サーバーの再起動でセッションが失われます。ファイルを開き直します。 |
| 記載されたツールがない | `formulon_version` の `serverVersion` を確認します。公開パッケージとローカルコードは異なる場合があります。 |

入力とファイル操作の動作は[ツール一覧](/ja/mcp/tools)と[セキュリティモデル](/ja/mcp/security)を参照してください。
