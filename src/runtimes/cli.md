# CLI Workflows

The `formulon` command runs the engine from shell scripts, CI jobs, and issue reproductions, with no host-language integration to write.

## Install and first run

```sh
curl -LO https://github.com/libraz/formulon/releases/download/v0.16.0/formulon-0.16.0-linux-x64.tar.gz
tar -xzf formulon-0.16.0-linux-x64.tar.gz
./formulon-0.16.0-linux-x64/formulon eval '=SUM(1,2,3)'   # 6
```

Archives exist for `linux-x64`, `linux-arm64`, and `darwin-arm64`, each with a `.sha256` file beside it. Move the `formulon` binary onto your `PATH` to use the commands below as written.

::: info Glossary: standalone binary
One executable with the engine and its libraries linked in. It needs no Node, Python, or Formulon shared library; only the operating system's C and C++ runtime libraries.
:::

The four commands:

- `eval`: evaluate one formula on a fresh, empty workbook.
- `recalc`: recalculate a workbook and write the result to a new file.
- `dump`: print formulas, values, sheet names, or metadata in a diff-friendly form.
- `paginate`: resolve one worksheet's print area and page breaks.

Every command accepts `--profile ID` (default `win-365-en_US`) and `--now DATE`, which pins `NOW()`, `TODAY()`, and relative date filters for the invocation. Neither is saved into the file. Pass both in CI so results do not depend on the runner's locale or clock.

`eval` treats a formula typo as a cell-level result: it prints `#NAME?` and exits `0`. A script that must reject typos has to check the output, because the exit code only reports usage and host failures. [CLI reference](/api/cli) lists every flag, output format, and exit code.

## Examples

```sh
formulon --version
formulon eval --json '=1/0'                 # {"kind":"error","value":"#DIV/0!"}
formulon recalc --profile win-365-en_US --now 2026-10-09T09:30:00 input.xlsx -o output.xlsx
formulon recalc --threads 4 input.xlsx -o output.xlsx
formulon dump --formulas input.xlsx
formulon dump --values output.xlsx
formulon dump --sheets input.xlsx
formulon dump --metadata input.xlsx
formulon paginate --sheet 0 input.xlsx
```

::: tip --values recalculates; --formulas does not
`dump --values` recalculates the workbook before printing values, so it sees up-to-date results. `dump --formulas` and `dump --metadata` skip recalculation to stay cheap and side-effect-free.
:::

## End option parsing with `--`

All four commands accept `--` to end option parsing. Put command options before it, then pass exactly one positional formula (`eval`) or input path (`recalc`, `dump`, `paginate`). This also permits a relative path beginning with `-`:

```sh
formulon dump --sheets -- -input.xlsx
formulon recalc --quiet -o output.xlsx -- -input.xlsx
```

## Output format follows the -o extension

`recalc` picks the saved container format from `-o`'s extension, not from the input file: `.xlsb` writes MS-XLSB, anything else writes OOXML `.xlsx`.

```sh
formulon recalc model.xlsx -o model.xlsb
```

Writing XLSB can drop or defer features that XLSX keeps; `recalc` reports each loss on stderr (see [Loss warnings](/api/cli#loss-warnings)), and [File format support](/compatibility/file-format-support) lists the boundaries. The write is atomic, so a failed load, recalc, or save leaves an existing target unchanged.

A malformed formula stored in the input file stays loadable and becomes a `#NAME?` cell after recalculation; it does not fail the command.

`recalc` is serial unless `--threads N` is given (`0` for automatic detection, `1` for the caller thread only, `2..8` for a worker cap).

## Iterative calculation

Workbooks with intentional circular references need iterative calculation. Without it, `recalc` settles cycles by the non-iterative rules in [Recalculation](/workbook/recalculation):

```sh
formulon recalc circular.xlsx -o circular.xlsx --iterative
```

`--iterative` enables iterative calculation and preserves the workbook's maximum-iteration and convergence-threshold settings. The CLI has no flags to override those two workbook settings; configure them in the workbook before invoking `recalc`.

## CI usage

`dump --values` and `dump --formulas` write stable text that a checked-in golden file can be diffed against. [CI regression workflows](/runtimes/ci-regression) covers the snapshot setup and how to handle volatile and external-service functions.

## Read next

- [CLI reference](/api/cli) — full command syntax.
- [CI regression scenarios](/runtimes/ci-regression) — patterns for CI gating.
- [CI workbook regression scenario](/scenarios/ci-regression) — example pipeline.
