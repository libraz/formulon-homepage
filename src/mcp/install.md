# Install formulon-mcp

`formulon-mcp` is published to npm and runs unmodified through `npx`. Most MCP clients only need a one-line registration.

::: tip Node.js 22+ is required
The server uses Node 22 features. Earlier versions will fail to start. Check with `node --version`.
:::

## Claude Code

```sh
claude mcp add --scope user formulon -- npx -y @libraz/formulon-mcp
```

Verify with:

```sh
claude mcp list
```

`formulon` should report `✓ Connected`. If it does not, the [Claude Code docs](https://docs.claude.com/en/docs/claude-code/mcp) include logs and troubleshooting steps.

### Project scope

The command above uses `--scope user`, which registers `formulon` for every project. To scope it to a single repository instead, write a `.mcp.json` file in the project root:

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

Claude Code picks up `.mcp.json` automatically for any session opened inside that directory — no `claude mcp add` call needed. The interactive installer below can write this file for you.

## Codex CLI

Add this entry to `~/.codex/config.toml`:

```toml
[mcp_servers.formulon]
command = "npx"
args = ["-y", "@libraz/formulon-mcp"]
```

Restart `codex` and the server will appear in tool discovery.

## Claude Desktop

Add `formulon` to `claude_desktop_config.json` (location depends on OS):

| OS | Path |
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

Restart Claude Desktop. The tools will be available in the next session.

## Interactive setup

Instead of hand-editing config files, the package ships an installer that registers (or removes) `formulon` across one or more clients:

```sh
npx -y @libraz/formulon-mcp init
```

It prompts for one or more targets, comma-separated:

1. Claude Code — user (`~/.claude.json`)
2. Claude Code — project (`./.mcp.json`)
3. Codex CLI (`~/.codex/config.toml`)
4. Claude Desktop (path per OS, see above)

It previews what each file will change (new / merge / replace an existing `formulon` entry) before writing, and never touches other servers already registered in the same file. Restart the client afterward to pick up the change.

To remove the entry later:

```sh
npx -y @libraz/formulon-mcp uninstall
```

Same target menu; each target is left untouched if it has no `formulon` entry to remove.

## Other stdio MCP clients

Any stdio-capable MCP client works. Point it at:

```sh
npx -y @libraz/formulon-mcp
```

Or, after a global install:

```sh
npm install -g @libraz/formulon-mcp
formulon-mcp
```

::: info Glossary: stdio MCP server
A long-running child process that speaks JSON-RPC over stdin / stdout. The client owns process lifetime; killing the parent terminates the server. No port is opened.
:::

## From source

For development or to pin a specific fork:

```sh
git clone https://github.com/libraz/formulon-mcp.git
cd formulon-mcp
yarn install
yarn run build
```

Register the absolute path to the built `dist/index.js`:

```sh
claude mcp add --scope user formulon node /absolute/path/to/formulon-mcp/dist/index.js
```

Or install the latest `main` without a local clone:

```sh
npx -y github:libraz/formulon-mcp
```

## Verifying the install

Inside any connected client, the model has access to:

- `formulon_version` — returns the loaded Formulon engine version.
- `formulon_eval_formula` — evaluates one Excel formula in a throwaway workbook.

Calling either is a low-cost smoke test.

## Read next

- [Workflow](/mcp/workflow) — the open / mutate / recalc / save loop.
- [Tools](/mcp/tools) — every tool, grouped by category.
- [Security model](/mcp/security) — what the server is allowed to do.
