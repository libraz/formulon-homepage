# CLI Reference

The `formulon` binary ships as `formulon-<version>-<os>-<arch>.tar.gz` on GitHub Releases for darwin-arm64, linux-x64, and linux-arm64. [CLI workflows](/runtimes/cli) shows the download and first run.

## Top-level

```sh
formulon <command> [options] [--] <argument>
formulon <command> --help
formulon --version
formulon --help
```

`<command>` is `eval`, `recalc`, `dump`, or `paginate`. Every command takes exactly one positional argument (a formula for `eval`, an input path for the others), and accepts these shared options:

| Option | Effect |
| --- | --- |
| `--profile <id>` | Excel behavior profile. Default `win-365-en_US`; one of the 28 ids. An unknown id is a usage error that lists the supported ids |
| `--now <date[Thh:mm:ss]>` | Pins `NOW()`, `TODAY()`, and relative date filters to local wall time: `YYYY-MM-DD` (midnight) or `YYYY-MM-DDThh:mm:ss`, from 1900-01-01 to 9999-12-31. The pin is not written into a saved workbook |
| `-h`, `--help` | Print the command's usage to stdout and exit `0` |
| `--version` | Print the engine version and exit `0` |
| `--` | End option parsing; the next token is the positional argument even when it starts with `-` |

Options may come before or after the positional argument, but not after `--`. Repeating a value option replaces the earlier value. Diagnostics go to stderr, prefixed with `formulon: <command>:`.

## Exit codes

A cell-level Excel error is a successful result, not a failure: the command prints it to stdout and exits `0`.

| Code | Meaning |
| --- | --- |
| `0` | Success, including formulas that evaluate to `#DIV/0!`, `#NAME?`, and other Excel errors |
| `64` | Usage error: unknown flag, missing or extra positional argument, bad option value, missing `-o` |
| `1` | Engine, file I/O, or stdout write failure |

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
formulon eval [--json] [--repeat N] [shared options] [--] <formula>
```

Evaluates one formula on a new workbook whose evaluation anchor is `Sheet1!A1`. The formula may be passed with or without a leading `=`.

| Flag | Effect |
| --- | --- |
| `--json` | Emit JSON instead of plain text |
| `--repeat N` | Evaluate the formula `N` times (a positive integer) and print `formulon: eval: N iterations in <t>us` to stderr |

```sh
formulon eval '=SUM(1,2,3)'        # → 6
formulon eval --json '=1/0'         # → {"kind":"error","value":"#DIV/0!"}
formulon eval '=SUM('               # → #NAME?; stdout, exit 0
formulon eval '=SEQUENCE(2,2)'       # → two tab-separated rows: 1\t2 and 3\t4
formulon eval --json '=SEQUENCE(2,2)' # → nested arrays of typed value objects
formulon eval --profile mac-365-de_DE --now 2026-10-09T09:30:00 '=NOW()'
```

Plain output is one line per result row with TAB-separated cells; control characters inside a value use JSON-style backslash escapes (`\t`, `\n`), as in `dump`. With `--json`, a 1×1 result is a single `{"kind": ..., "value": ...}` object and anything larger is a row-major array of arrays of those objects. `kind` is `blank`, `number`, `bool`, `text`, `error`, `array`, `ref`, or `lambda`; `value` is `null` for blank, array, ref, and lambda.

Malformed syntax is not a command failure: `eval` prints `#NAME?` and exits `0`, so a script that must reject a typo has to inspect the output. Host APIs differ here: `setFormula()` rejects malformed text with `kParserUnexpectedToken`.

## `recalc`

```sh
formulon recalc [--iterative] [--threads N] [--quiet] [shared options] <in.xlsx-or-xlsb> -o <out.xlsx-or-xlsb>
formulon recalc [--iterative] [--threads N] [--quiet] [shared options] -o <out.xlsx-or-xlsb> -- <in.xlsx-or-xlsb>
```

Loads a workbook, recalculates, and writes a new workbook.

| Flag | Effect |
| --- | --- |
| `-o`, `--output PATH` | Required, non-empty output path. Must come before `--` |
| `--iterative` | Enable iterative calculation for intentional cycles; the workbook's maximum-iteration and convergence-threshold settings are kept |
| `--threads N` | Opt into the parallel scheduler: `0` auto-detects up to 8 workers, `1` stays on the caller thread, and `2..8` sets the worker cap. Other values are a usage error. Without the flag, recalculation is serial |
| `--quiet` | Suppress the success status line; loss warnings remain visible |

The output container is chosen from `-o`'s extension: `.xlsb` writes MS-XLSB, any other extension (or none) writes OOXML `.xlsx`. The input format is detected from the bytes, not the extension.

The write is atomic: Formulon writes a temporary file and replaces the target only after recalculation and serialization succeed, so a failure never destroys the existing target.

On success, `recalc` prints `formulon: recalc: ok, wrote <n> bytes to '<out>'` to stderr. With `--threads`, the line also carries the scheduler statistics (`threads`, `cells_evaluated`, `sccs_processed`, `parallel_steps`, `serial_fallback_steps`, `cycle_recoveries`, `worker_threads_started`, `worker_threads_used`). stdout stays empty.

## `dump`

```sh
formulon dump [--formulas|--values|--sheets|--metadata] [shared options] [--] <in.xlsx-or-xlsb>
```

The four modes are mutually exclusive. Each line escapes control characters the same way as `eval`.

| Mode | Output |
| --- | --- |
| `--formulas` (default) | `Sheet!A1 =formula` for every formula cell, sheet by sheet in `(row, col)` order. No recalculation |
| `--values` | `Sheet!A1 <rendered value>` for every non-blank cell, after a recalculation |
| `--sheets` | One sheet name per line in document order |
| `--metadata` | `[defined_names]`, `[tables]`, and `[passthrough_parts]` sections; an empty section still prints its header. No recalculation |

In `--metadata`, a sheet-scoped name prints as `Sheet!Name formula`, and a table prints as `name display_name sheet_index ref`.

## `paginate`

```sh
formulon paginate [--sheet INDEX] [shared options] [--] <in.xlsx-or-xlsb>
```

Resolves the selected worksheet's print area, automatic page breaks, and physical page count. `INDEX` defaults to `0`; both sheet indexes and output coordinates are zero-based. Print-area coordinates are inclusive. The output is line-oriented:

```text
sheet=0
pages=2
print_area=0:0-49:7
horizontal_breaks=25
vertical_breaks=4
```

Multiple print areas and multiple break positions are comma-separated; a sheet without breaks prints an empty value (`horizontal_breaks=`).

## Loss warnings

`recalc`, `dump`, and `paginate` print a warning to stderr when the loaded workbook reports non-zero read-loss counters. `recalc` also reports write-loss counters for the file it saved. Only non-zero counters appear, and the warnings never change the exit code.

| Warning line | Counters |
| --- | --- |
| `formulon: <command>: warning: XLSB read diagnostics` | `undecoded_formula_count`, `undecoded_defined_name_count`, `undecoded_part_count` |
| `formulon: <command>: warning: OOXML read diagnostics` | `skipped_feature_count`, `unknown_content_type_count` |
| `formulon: recalc: warning: XLSB write diagnostics` or `OOXML write diagnostics` | `downgraded_formula_count`, `deferred_feature_count`, `dropped_part_count`, `dropped_relationship_count`, `renumbered_part_count` |

A dropped part also drops the relationship that points at it, so `dropped_part_count` and `dropped_relationship_count` can describe the same loss; do not add them. The counters cover only the losses listed in [Container format](/api/wasm#container-format).

## Read next

- [CLI workflows](/runtimes/cli) — how the commands fit into shell pipelines.
- [CI workbook regression scenario](/scenarios/ci-regression) — full CI example.
