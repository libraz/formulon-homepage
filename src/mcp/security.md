# Security Model

`formulon-mcp` is designed to give agents structured, observable access to workbook operations. The server's guarantees are deliberately narrow so that hosting it inside an agent loop does not become a code-execution surface.

::: info Glossary: allowlist
A whitelist of method names the server is willing to invoke on a `Workbook`. Anything not on the list is rejected at the dispatch layer, regardless of the input shape. The allowlist lives in `src/sessions.ts` of the `formulon-mcp` repo.
:::

## What the server does *not* do

- It does not evaluate arbitrary JavaScript, TypeScript, Python, or VBA. Formula evaluation happens entirely inside the Formulon C++17 engine.
- It does not load user-supplied native modules. The only native code is the engine itself.
- It does not open network sockets. The transport is stdio; the server has no HTTP server, no outbound fetcher, and does not require network access for calculation.
- It does not preserve state across server restarts. Sessions live in process memory only.

## Process boundary

A stdio MCP server runs as a child process of the client. The OS process boundary is the security boundary:

- The server inherits the client's file-system permissions. Sandbox the client, and the server is sandboxed too.
- Killing the client (or the agent that owns it) terminates the server and clears every open session.
- Multiple clients run separate server processes; sessions never cross processes.

## File-system access

Tools that name a path (`formulon_open_workbook`, `formulon_save_session`, `formulon_get_cell` direct-from-path) operate on whatever paths the server process can see. Restrict the parent's working directory, or run the agent inside a sandbox, if you want to keep workbook IO inside a project.

::: tip Agents and write paths
If the workflow only requires reading, instruct the agent to write outputs to a designated subdirectory or pass bytes back inline (omit `outputPath` in `formulon_save_session`). The server has no `target directory` policy of its own — that is up to the host.
:::

## Tool input validation

Every tool's inputs are validated against a JSON schema before reaching the engine. Malformed payloads return an MCP error response without touching the session. Numeric coordinates are range-checked; A1 references are parsed and rejected if they cannot resolve to a sheet.

## Low-level access is allowlisted

`formulon_workbook_call` exists for advanced features that do not yet have dedicated tools. Even so, it only dispatches methods on an explicit allowlist defined in the server source. Examples of allowlisted methods include:

- PivotTable / PivotCache reads,
- style / merge / comment / hyperlink / validation accessors,
- conditional formatting evaluation,
- dependency graph queries (`precedents`, `dependents`),
- function metadata and name helpers,
- spill information.

Methods not on the allowlist — including any future engine method considered too broad — are rejected. The allowlist is reviewed when the server is updated.

## Session isolation

- Each `sessionId` owns its own workbook instance, dependency graph, dirty set, and recalc state.
- Sessions cannot read each other's cells.
- `formulon_close_workbook` releases the engine state immediately; `formulon_list_sessions` lets the agent (or a watcher) see what is still open.

## VBA is preserved, never executed

Workbooks containing VBA round-trip through Formulon. The macros are stored as passthrough bytes and rewritten on save, but the engine never compiles, interprets, or executes them.

## Read next

- [Workflow](/mcp/workflow) — operational loop the security model surrounds.
- [Tools](/mcp/tools) — each tool's purpose.
