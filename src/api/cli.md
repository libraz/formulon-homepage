# CLI Reference

## Top-level

```sh
formulon <command> [options]
formulon --version
formulon --help
```

::: info Glossary: exit codes
The CLI follows a two-tier convention. Cell-level Excel errors (`#DIV/0!`, `#VALUE!`, …) print to stdout and the process returns 0 — the command succeeded, the formula simply produced an error value. Structural failures (missing file, bad bytes, internal engine failure) return non-zero so shell scripts can branch on `$?`.
:::

## `eval`

```sh
formulon eval [--json] [--repeat N] <formula>
```

Evaluates a single formula on a fresh empty workbook. The formula may be passed with or without a leading `=`.

| Flag | Effect |
| --- | --- |
| `--json` | Emit a structured JSON result instead of a string |
| `--repeat N` | Evaluate the same formula `N` times — useful for micro-benchmarks |

```sh
formulon eval '=SUM(1,2,3)'        # → 6
formulon eval --json '=1/0'         # → {"kind":"error","code":"#DIV/0!", ...}
```

Cell-level Excel errors print to stdout and return exit code 0. Structural failures return a non-zero exit code.

## `recalc`

```sh
formulon recalc [--iterative] [--quiet] <in.xlsx> -o <out.xlsx>
```

Loads an `.xlsx`, recalculates, and writes a new workbook.

| Flag | Effect |
| --- | --- |
| `--iterative` | Enable iterative calculation for intentional cycles |
| `--quiet` | Suppress progress / status output |

## `dump`

```sh
formulon dump [--formulas|--values|--sheets|--metadata] <in.xlsx>
```

| Mode | Output |
| --- | --- |
| `--formulas` | Formula cells in stable order; default |
| `--values` | Non-blank cells after recalculation |
| `--sheets` | Sheet names in document order |
| `--metadata` | Defined names, tables, passthrough parts |

::: tip CI use
`dump --formulas` and `dump --metadata` skip recalculation, so they are cheap enough to gate every PR. `dump --values` recalculates first, so it is the right snapshot for golden-output tests.
:::

## Read next

- [CLI workflows](/runtimes/cli) — how the commands fit into shell pipelines.
- [CI workbook regression scenario](/scenarios/ci-regression) — full CI example.
