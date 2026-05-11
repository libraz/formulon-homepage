# 数式を評価する

ワークブック UI を持たずに Excel 互換の数式セマンティクスが必要な場合、最小のワークブックを作って評価できます。

::: info Excel error は値
`#DIV/0!`、`#VALUE!`、`#NAME?` は spreadsheet value として返ります。Host API failure は runtime ごとの status envelope、exception、non-zero exit で扱います。
:::

## JavaScript / WASM

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()

const result = Module.evalFormula('=SUM(1,2,3)')
if (!result.status.ok) {
  throw new Error(result.status.message)
}

if (result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

## Python

```python
import formulon

value = formulon.eval_formula("=SUM(1,2,3)")
print(value.to_python())
```

## CLI

```sh
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
```

Excel のセルエラーは値です。`=1/0` は `#DIV/0!` のような error value として返り、process / Python / JS の例外とは別に扱います。
