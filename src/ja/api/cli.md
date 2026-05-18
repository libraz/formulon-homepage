# CLI リファレンス

## トップレベル

```sh
formulon <command> [options]
formulon --version
formulon --help
```

::: info 用語: 終了コード
CLI は 2 層の規約に従います。セル単位の Excel エラー（`#DIV/0!`、`#VALUE!` など）は stdout に出力し、プロセスは 0 を返します。コマンド自体は成功しており、数式がエラー値を返しただけです。構造的失敗（ファイル無し・バイト列不正・エンジン内部失敗）は非ゼロを返し、シェルスクリプトから `$?` で分岐できます。
:::

## `eval`

```sh
formulon eval [--json] [--repeat N] <formula>
```

新規ワークブックで 1 式を評価します。leading `=` の有無は問いません。

| フラグ | 効果 |
| --- | --- |
| `--json` | 文字列ではなく構造化 JSON で出力 |
| `--repeat N` | 同じ式を `N` 回評価。マイクロベンチ用途 |

```sh
formulon eval '=SUM(1,2,3)'        # → 6
formulon eval --json '=1/0'         # → {"kind":"error","code":"#DIV/0!", ...}
```

セル単位エラーは stdout、exit 0。構造的失敗は非ゼロ。

## `recalc`

```sh
formulon recalc [--iterative] [--quiet] <in.xlsx> -o <out.xlsx>
```

`.xlsx` をロードして再計算し、新しいワークブックを書き出します。

| フラグ | 効果 |
| --- | --- |
| `--iterative` | 意図的な循環参照のために反復計算を有効化 |
| `--quiet` | 進捗 / ステータス出力を抑制 |

## `dump`

```sh
formulon dump [--formulas|--values|--sheets|--metadata] <in.xlsx>
```

| モード | 出力 |
| --- | --- |
| `--formulas` | 安定順序の数式セル。デフォルト |
| `--values` | 再計算後の非空セル |
| `--sheets` | ドキュメント順のシート名 |
| `--metadata` | defined name、table、保持対象パート |

::: tip CI での使い方
`dump --formulas` / `--metadata` は再計算しないので、PR ごとに走らせても安価です。`dump --values` は事前に再計算するため、期待値ファイルとの計算値比較に向きます。
:::

## 次に読むもの

- [CLI ワークフロー](/ja/runtimes/cli) ─ シェルパイプラインへの組み込み
- [CI でワークブック回帰検査](/ja/scenarios/ci-regression) ─ CI 例
