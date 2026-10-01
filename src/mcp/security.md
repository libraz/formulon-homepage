---
description: Filesystem permissions, session isolation, allowlisted API access, and mutation failure behavior.
---

# Security model

`formulon-mcp` runs as a local stdio process with the filesystem permissions granted by its host. It has no built-in directory allowlist, authentication layer, or per-user session access control. Apply filesystem and process restrictions in the MCP client or operating system when required.

## Paths and writes

Workbook input paths, workbook output paths, and preview artifact paths resolve in the server process. Relative paths use its working directory, which may differ from the directory visible in a chat. Use absolute paths when configuring an agent workflow.

Changing the working directory does not restrict filesystem access. The server can read, create, or overwrite any accessible path accepted by its tools. `formulon_preview_range` can also write `.png` or `.svg` files through `outputPath`.

`formulon_save_session` resolves its destination in this order: the explicit `outputPath`, the session's previous output path, then the original source path. Omitting the argument can overwrite the input workbook. Use a separate explicit output path for review workflows. Saving returns a byte count and diagnostics, not downloadable workbook bytes.

## Session lifetime and isolation

Each `sessionId` identifies a separate in-memory workbook. Separate server processes have separate session tables. Within one process, callers that know a session ID can use it; IDs are handles rather than access credentials.

Closing a workbook discards its in-memory state, including unsaved changes. Server termination discards all sessions. There is no automatic persistence or recovery journal. The MCP client manages the child process; ensure it stops the server when the connection is closed.

## Validated inputs and partial mutations

Tool schemas validate JSON shapes before dispatch. Higher-level operations also resolve addresses and enforce their own limits. Cell batches preflight addresses and finite numbers; layout batches preflight their complete operation list before applying it.

Validation is not a transaction. An engine failure during application can leave earlier writes in place. A low-level mutating call marks the session dirty before invoking the engine, even if the call fails. Inspect the workbook after a failed mutation; reopen the source in a new session to discard partial work. See [workflow](/mcp/workflow).

## Allowlisted API access

`formulon_workbook_call` invokes only methods listed in [`src/session/workbook-call.ts`](https://github.com/libraz/formulon-mcp/blob/main/src/session/workbook-call.ts). It does not evaluate JavaScript or execute caller-supplied code. Workbook lifecycle and raw save methods (`save`, `saveAs`, `saveWithDiagnostics`) are withheld, as is callback-based `setIterativeProgress`.

Use [API discovery](/mcp/advanced) to read signatures and access classifications from the installed engine before constructing positional arguments. The allowlist controls which methods can be reached; it does not establish whether a requested edit is appropriate.

## Calculation, previews, and external content

The server does not run VBA. Existing macro and drawing content may be preserved as passthrough parts where the engine supports it; inspect load and save diagnostics for the actual file. The engine does not fetch external workbook links automatically.

Formula calculation uses the Formulon WASM engine. PNG previews use the packaged native `@resvg/resvg-js` renderer and installed system fonts. The server exposes no HTTP transport or arbitrary module-loading tool. Package installation through `npx` can require network access; calculation itself uses the local engine.

For format and formula limits, read [file format support](/compatibility/file-format-support) and [formula coverage](/compatibility/formula-coverage). For rendering limits, read [layout and previews](/mcp/layout-preview).
