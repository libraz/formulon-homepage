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

<DiagramLayers label="Two-tier exit-code convention" :layers="[
  { nodes: ['Command runs (eval / recalc / dump / paginate)'] },
  { nodes: [
      { label: 'Cell-level Excel error', note: 'stdout + exit 0' },
      { label: 'Usage error', note: 'stderr + exit 64' },
      { label: 'Engine or I/O failure', note: 'stderr + exit 1' }
    ]
  }
]" />

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

Cell-level Excel errors print to stdout and return exit code 0. Usage errors return 64. Engine and I/O failures return 1.

## `recalc`

```sh
formulon recalc [--iterative] [--quiet] <in.xlsx> -o <out.xlsx>
```

Loads a workbook, recalculates, and writes a new workbook.

| Flag | Effect |
| --- | --- |
| `--iterative` | Enable iterative calculation for intentional cycles |
| `--quiet` | Suppress progress / status output |

The output container format is chosen from `-o`'s extension: `.xlsb` writes MS-XLSB, any other extension (or none) writes OOXML `.xlsx`. The input file's format is auto-detected from its bytes, not its extension, so `<in>` may itself be `.xlsb` even though the usage string says `<in.xlsx>`.

The write is atomic: Formulon writes a temporary file and replaces the target only after recalculation and serialization succeed. A failed recalc never destroys the existing target.

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

Like `recalc`, the input format is content-sniffed rather than restricted to `.xlsx` — `.xlsb` input works for every dump mode.

## `paginate`

```sh
formulon paginate [--sheet INDEX] <in.xlsx>
```

Resolves the selected worksheet's print area, automatic page breaks, and physical page count. `INDEX` defaults to `0`; both sheet indexes and output coordinates are zero-based. Print-area coordinates are inclusive. The output is line-oriented:

```text
sheet=0
pages=2
print_area=0:0-49:7
horizontal_breaks=25
vertical_breaks=4
```

The command exits `0` on success, `64` for usage errors, and `1` for engine or I/O failures.

::: tip CI use
`dump --formulas` and `dump --metadata` skip recalculation, so they are cheap enough to gate every PR. `dump --values` recalculates first, so it is the right snapshot for golden-output tests.
:::

## Read next

- [CLI workflows](/runtimes/cli) — how the commands fit into shell pipelines.
- [CI workbook regression scenario](/scenarios/ci-regression) — full CI example.
