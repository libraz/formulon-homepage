---
description: stdio サーバーの登録、最初の計算、クライアント起動時の問題を確認します。
---

# formulon-mcp のインストール

npm パッケージ `@libraz/formulon-mcp` は stdio MCP サーバーとして動きます。[`engines` の要件](https://github.com/libraz/formulon-mcp/blob/main/package.json)を満たす Node.js（22 以上）を用意してください。通常の利用ではリポジトリの取得は不要です。

## 対話式セットアップ

現在の公開版は `0.9.1` で、`@libraz/formulon` の依存範囲は `^0.15.2` です。以下のコマンドはこの版の初期化ツールを選びます。最新の公開版を実行する場合は `@0.9.1` を省略してください。

ターミナルで同梱のインストーラーを実行します。

```sh
npx -y @libraz/formulon-mcp@0.9.1 init
```

上のコマンドで固定されるのは初期化ツールだけです。`init` はクライアント設定へ、バージョンなしの `@libraz/formulon-mcp` を書き込みます。実行時のパッケージを固定するには、生成された各エントリの引数を次の形へ手動で変更します。

```json
{ "args": ["-y", "@libraz/formulon-mcp@0.9.1"] }
```

`init` を再実行すると、バージョンなしのパッケージ名でエントリが書き直されます。再実行後は実行時の固定をもう一度適用してください。

対象の番号をカンマ区切りで指定します。空欄なら `1`（Claude Code のユーザースコープ）を選びます。

| 番号 | 対象 | 設定ファイル |
| --- | --- | --- |
| `1` | Claude Code — ユーザー | `~/.claude.json` |
| `2` | Claude Code — プロジェクト | 現在のディレクトリの `.mcp.json` |
| `3` | Codex CLI | `~/.codex/config.toml` |
| `4` | Claude Desktop | macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`<br>Windows: `%APPDATA%\Claude\claude_desktop_config.json`<br>Linux: `~/.config/Claude/claude_desktop_config.json` |

対象を選んだあと、既定の [Excel プロファイル](/ja/mcp/workflow#excel-profile)を番号付きの 2 つのメニューで尋ねます。

1. ロケールのメニュー。`0` はエンジンの既定（英語、Windows）、`1` から `14` は対応ロケールで、英語のラベルが付きます。Enter を押すと、OS や `LANG` から検出したシステムロケールを選びます。一致するものがなければ同じ言語のロケール、それもなければ `0` です。
2. ホストのメニュー。`1` が Windows、`2` が Mac です。Enter を押すと現在の OS を選びます。

`0` を選ぶとホストの質問は省略され、プロファイルは書き込まれません。確認の前に、選んだプロファイルがプレビューに表示されます。`--profile <id>`（または `--profile=<id>`）を渡すと 2 つのメニューを省略できます。未知の ID はエラーで停止します。

```sh
npx -y @libraz/formulon-mcp@0.9.1 init --profile win-365-ja_JP
```

`--profile` で省略できるのはプロファイルのメニューだけです。対象の選択と最後の確認は引き続き標準入力から 1 行ずつ読むため、スクリプトから実行するときは回答をパイプで渡します。

```sh
printf '1\ny\n' | npx -y @libraz/formulon-mcp@0.9.1 init --profile win-365-ja_JP
```

プロファイルはサーバーエントリの環境変数 `FORMULON_MCP_PROFILE` として書き込まれます。`init` を再実行するとエントリが書き直されるため、プロファイルなしで実行すると、以前に書き込んだプロファイルは消えます。

インストーラーはファイルの新規作成、既存設定への追加、既存の `formulon` エントリの置き換えを表示して、書き込み前に確認します。他のサーバー設定は保持します。プロジェクトスコープではプロジェクトのルートで実行してください。登録後はクライアントを再起動します。

登録を削除するには次を実行します。

```sh
npx -y @libraz/formulon-mcp@0.9.1 uninstall
```

削除メニューの既定値は 4 種類すべてのクライアントです。選択した設定ファイルから `formulon` のエントリを削除します。Node.js や他の MCP サーバーは削除しません。

## 手動での登録

JSON 設定を使うクライアントでは、既存の `mcpServers` オブジェクトに次のエントリを追加します。

```json
{
  "mcpServers": {
    "formulon": {
      "command": "npx",
      "args": ["-y", "@libraz/formulon-mcp@0.9.1"]
    }
  }
}
```

Codex CLI で実行時パッケージを固定する TOML セクションは次のとおりです。

```toml
[mcp_servers.formulon]
command = "npx"
args = ["-y", "@libraz/formulon-mcp@0.9.1"]
```

既定の Excel プロファイルを指定するには、エントリに `env` を追加します。

```json
{
  "mcpServers": {
    "formulon": {
      "command": "npx",
      "args": ["-y", "@libraz/formulon-mcp@0.9.1"],
      "env": { "FORMULON_MCP_PROFILE": "win-365-ja_JP" }
    }
  }
}
```

```toml
[mcp_servers.formulon]
command = "npx"
args = ["-y", "@libraz/formulon-mcp@0.9.1"]
env = { FORMULON_MCP_PROFILE = "win-365-ja_JP" }
```

サーバーが読む環境変数は次の 2 つです。

| 変数 | 効果 |
| --- | --- |
| `FORMULON_MCP_PROFILE` | `formulon_open_workbook`、`formulon_inspect_workbook`、`formulon_update_workbook` の呼び出しで `profile` を省略したときに使う Excel プロファイル |
| `FORMULON_MCP_PRETTY` | `1` にすると、デバッグ用に JSON 応答を整形して返します。既定の圧縮 JSON のほうがトークン数は少なくなります |

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

バージョンを指定しない `npx` コマンドは npm の公開パッケージを選びます。公開前のローカルコードを使うには、チェックアウトをビルドしてエントリポイントの絶対パスを登録します。

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

依存するエンジンパッケージが取得できる必要があります。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| サーバーが起動しない | Node.js、`npx`、クライアントの PATH、サーバーログを確認します。 |
| ターミナルでコマンドが待ち続ける | `init` なしで実行すると stdio 接続を開始し、MCP クライアントを待ちます。 |
| 登録後もツールが出ない | クライアントを再起動し、選択した設定ファイルを読み込んだか確認します。 |
| ワークブックを開けない | サーバーから見える絶対パスとファイル権限を確認します。 |
| セッション ID が見つからない | サーバーの再起動でセッションが失われます。ファイルを開き直します。 |
| 記載されたツールがない | `formulon_version` の `serverVersion` を確認します。公開パッケージとローカルコードは異なる場合があります。 |

入力とファイル操作の動作は[ツール一覧](/ja/mcp/tools)と[セキュリティモデル](/ja/mcp/security)を参照してください。
