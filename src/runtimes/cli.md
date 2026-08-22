# CLI Workflows

The CLI is the lowest-friction Formulon surface. It is useful when you need spreadsheet calculation in shell scripts, CI, or one-off reproductions — without writing a host-language integration.

::: info Glossary: standalone binary
A single executable file that links Formulon and a minimal command runner. No Node, Python, or shared libraries required at runtime. Download per `(os, arch)` from GitHub Releases.
:::

Common workflows:

- `eval`: evaluate a formula or expression on a fresh, empty workbook (supports `--json` and `--repeat N`).
- `recalc`: recalculate a workbook and write updated bytes.
- `dump`: inspect workbook structure and calculated values.
- `paginate`: resolve one worksheet's print area and page breaks.

Use the CLI in CI to catch accidental workbook changes and to reproduce issues without writing a host-language integration first.

`eval` treats malformed formula syntax as a cell-level result: it prints `#NAME?` to stdout and exits `0`. Check the output when a shell script must reject a typo; the exit code distinguishes host/usage failures, not this Excel error value.

## Examples

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
formulon recalc input.xlsx -o output.xlsx
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

XLSB models styles, row/column layout, merges, date1904, sheet view/zoom/frozen panes, dynamic-array metadata, and supported tokenized formulas. Worksheet tails for conditional formatting, data validation, hyperlinks, auto-filter, print setup/breaks, and drawing/table references and relationships are preserved verbatim; preservation does not make them editable or evaluated. See [XLSB coverage](/compatibility/file-format-support).

`recalc` writes atomically: a failed load, recalc, or save leaves the existing target unchanged.

`recalc` is serial unless `--threads N` is supplied. The parallel SCC scheduler accepts `0` for automatic detection capped at 8, `1` for caller-thread-only execution with no workers, and `2..8` for a worker cap. Values outside `0..8` are rejected. A parallel call may use fewer workers than requested.

The command reports loss diagnostics on stderr for undecoded formulas or defined names, dropped package parts, downgraded formula cells, and omitted modelled features. `--quiet` suppresses only the successful-write status line; it leaves these warnings visible.

## Iterative calculation

Workbooks with intentional circular references need iterative calculation enabled, or `recalc` converges to whatever the engine's non-iterative circular-reference handling produces:

```sh
formulon recalc circular.xlsx -o circular.xlsx --iterative
```

`--iterative` enables iterative calculation and preserves the workbook's maximum-iteration and convergence-threshold settings. The CLI has no flags to override those two workbook settings; configure them in the workbook before invoking `recalc`.

## Pagination

```sh
formulon paginate [--sheet INDEX] <in.xlsx>
```

`INDEX` defaults to `0` and is zero-based. The output reports `sheet`, `pages`, inclusive zero-based `print_area`, `horizontal_breaks`, and `vertical_breaks`. Exit `0` means success, `64` means usage error, and `1` means an engine or I/O failure.

## CI usage

Run `recalc` and `dump --values` to snapshot calculated outputs against checked-in goldens. The CLI is deterministic for the same workbook + profile, so a `git diff` over the dump file is a stable signal in CI.

```sh
formulon recalc model.xlsx -o /tmp/model.recalc.xlsx --quiet
formulon dump --values /tmp/model.recalc.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

For formulas only:

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

This catches formula edits without depending on cached calculated values.

::: warning Volatiles are not deterministic
`NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, and a few network functions return different values on each call. Avoid them in CI snapshot fixtures, or stub them at the workbook level.
:::

## Read next

- [CLI reference](/api/cli) — full command syntax.
- [CI regression scenarios](/runtimes/ci-regression) — patterns for CI gating.
- [CI workbook regression scenario](/scenarios/ci-regression) — example pipeline.
