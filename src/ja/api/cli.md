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

<DiagramLayers label="2 層の終了コード規約" :layers="[
  { nodes: ['コマンドを実行 (eval / recalc / dump / paginate)'] },
  { nodes: [
      { label: 'セル単位の Excel エラー', note: 'stdout + exit 0' },
      { label: '使い方エラー', note: 'stderr + exit 64' },
      { label: 'エンジン / I/O 失敗', note: 'stderr + exit 1' }
    ]
  }
]" />

## `eval`

```sh
formulon eval [--json] [--repeat N] <formula>
```

新規ワークブックで 1 式を評価します。先頭の `=` の有無は問いません。

| フラグ | 効果 |
| --- | --- |
| `--json` | 文字列ではなく構造化 JSON で出力 |
| `--repeat N` | 同じ式を `N` 回評価。マイクロベンチ用途 |

```sh
formulon eval '=SUM(1,2,3)'        # → 6
formulon eval --json '=1/0'         # → {"kind":"error","value":"#DIV/0!"}
formulon eval '=SUM('               # → #NAME?（stdout、exit 0）
```

セル単位エラーは stdout、exit 0 です。`eval` の構文が不正な場合も同じで、Excel の `#NAME?` エラー値を stdout に出力して 0 で終了します。数式の typo を終了コードで検出せず、出力値を確認してください。使い方エラーは 64、エンジン / I/O 失敗は 1 です。

## `recalc`

```sh
formulon recalc [--iterative] [--threads N] [--quiet] <in.xlsx-or-xlsb> -o <out.xlsx-or-xlsb>
```

ワークブックをロードして再計算し、新しいワークブックを書き出します。

| フラグ | 効果 |
| --- | --- |
| `--iterative` | 意図的な循環参照のために反復計算を有効化し、ワークブックの最大反復回数と収束しきい値を保持 |
| `--threads N` | 並列 scheduler を使う。`0` は最大 8 worker を自動検出し、`1` は呼び出しスレッドで実行し、`2..8` は worker 数の上限を指定 |
| `--quiet` | 成功時のステータス出力を抑制。診断 warning は表示 |

出力コンテナ形式は `-o` の拡張子で決まります。`.xlsb` なら MS-XLSB を、それ以外（拡張子なしを含む）は OOXML `.xlsx` を書き出します。入力ファイルの形式はファイル名ではなくバイト列から自動判別されます。再計算は既定では直列で実行し、`--threads N` を指定すると並列 scheduler を使います。

`recalc` は一時ファイルへ書き込み、成功時だけ対象を置き換えます。再計算や保存に失敗しても既存の対象ファイルは壊れません。

`recalc` は読み込み時と保存時に検出した損失カウンターのうち、0 ではないものを stderr の warning として出力します。読み込んだコンテナに応じて、次の見出しを使います。

| 警告行 | カウンター |
| --- | --- |
| `warning: XLSB read diagnostics` | `undecoded_formula_count`、`undecoded_defined_name_count`、`undecoded_part_count` |
| `warning: OOXML read diagnostics` | `skipped_feature_count`、`unknown_content_type_count` |

保存時の警告は、書き出したコンテナに応じて `XLSB write diagnostics` または `OOXML write diagnostics` と表示され、`downgraded_formula_count`、`deferred_feature_count`、`dropped_part_count`、`dropped_relationship_count`、`renumbered_part_count` を含みます。0 のカウンターは出力されません。`dropped_part_count` と `dropped_relationship_count` は同じ損失を表す場合があるため、合計しないでください。これらはパッケージ損失の一部だけを対象とする警告で、コマンドが成功した場合の終了コードは変わりません。`--quiet` で抑制されるのは成功時のステータス行だけで、診断 warning は表示されます。

## `dump`

```sh
formulon dump [--formulas|--values|--sheets|--metadata] <in.xlsx-or-xlsb>
```

| モード | 出力 |
| --- | --- |
| `--formulas` | 安定順序の数式セル。デフォルト |
| `--values` | 再計算後の非空セル |
| `--sheets` | ドキュメント順のシート名 |
| `--metadata` | defined name、table、保持対象パート |

`recalc` と同様、入力形式は `.xlsx` に限定されず内容から自動判別されます。すべての dump モードで `.xlsb` 入力を扱えます。

## `paginate`

```sh
formulon paginate [--sheet INDEX] <in.xlsx-or-xlsb>
```

指定したシートの印刷範囲、自動改ページ、物理ページ数を解決します。`INDEX` の既定値は `0` で、シート番号と出力座標はすべて 0 始まりです。印刷範囲は両端を含みます。成功は終了コード `0`、使い方エラーは `64`、エンジン / I/O 失敗は `1` です。

::: tip CI での使い方
`dump --formulas` / `--metadata` は再計算しないので、PR ごとに走らせても安価です。`dump --values` は事前に再計算するため、期待値ファイルとの計算値比較に向きます。
:::

## 次に読むもの

- [CLI ワークフロー](/ja/runtimes/cli) ─ シェルパイプラインへの組み込み
- [CI でワークブック回帰検査](/ja/scenarios/ci-regression) ─ CI 例
