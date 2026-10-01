---
description: Register the stdio server, verify a first calculation, and troubleshoot client startup.
---

# Install formulon-mcp

The npm package `@libraz/formulon-mcp` runs as a stdio MCP server. Use a Node.js runtime satisfying the package's [`engines` requirement](https://github.com/libraz/formulon-mcp/blob/main/package.json) (Node.js 22 or newer). A normal installation needs no repository checkout.

## Interactive setup

Run the bundled installer in a terminal:

```sh
npx -y @libraz/formulon-mcp init
```

Choose one or more target numbers, separated by commas. An empty selection defaults to Claude Code user scope.

| Target | Configuration file |
| --- | --- |
| Claude Code — user | `~/.claude.json` |
| Claude Code — project | `.mcp.json` in the current directory |
| Codex CLI | `~/.codex/config.toml` |
| Claude Desktop — macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop — Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop — Linux | `~/.config/Claude/claude_desktop_config.json` |

The installer previews whether each file will be created, merged, or have its existing `formulon` entry replaced, then asks before writing. It preserves other server entries. For project scope, run it from the project root. Restart the client after registration.

To remove registration, run:

```sh
npx -y @libraz/formulon-mcp uninstall
```

The removal menu defaults to all four client targets. It removes the `formulon` entry from selected configuration files; it does not uninstall Node.js or other MCP servers.

## Manual registration

For clients using JSON configuration, add this server entry inside the existing `mcpServers` object:

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

For Codex CLI, the installer writes this TOML section:

```toml
[mcp_servers.formulon]
command = "npx"
args = ["-y", "@libraz/formulon-mcp"]
```

Other stdio clients use the same command and arguments. When configuring a GUI client, ensure its environment can find `node` and `npx`; a terminal's PATH may differ. Use an absolute executable path when needed.

## First calculation

Ask the connected agent:

> Use Formulon to report the server and engine versions, then evaluate `=SUM(10,20,30)`.

The agent calls `formulon_version` with `{}` and `formulon_eval_formula` with:

```json
{ "formula": "=SUM(10,20,30)" }
```

The formula response has a `value` envelope with `kind: "number"` and `value: 60`. This requires no workbook path or persistent session. Continue with the [workbook workflow](/mcp/workflow) to edit a file.

## Working with an unreleased checkout

The unpinned `npx` command runs the published npm package. To use local changes before publication, build the checkout and register its absolute entry path:

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

The checkout must have its engine dependency available. A website documenting the release candidate does not change the package selected by `npx`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Server does not start | Check Node.js, `npx`, the client's PATH, and its server logs. |
| Command appears to wait in a terminal | Running the server without `init` starts stdio transport and waits for an MCP client. |
| No tools appear after setup | Restart the client and confirm it loaded the selected config file. |
| Workbook path cannot be opened | Use an absolute path visible to the server; check file permissions. |
| Session ID is unknown | Server restarts discard sessions. Open the file again. |
| A documented tool is missing | Check `serverVersion` from `formulon_version`; a local checkout and the published package can differ. |

See the [tool catalogue](/mcp/tools) and [security model](/mcp/security) for input and filesystem behavior.
