# CLI リファレンス

`formulon` バイナリは GitHub Releases の `formulon-<version>-<os>-<arch>.tar.gz` として、darwin-arm64、linux-x64、linux-arm64 向けに配布しています。ダウンロードと最初の実行は [CLI ワークフロー](/ja/runtimes/cli) を参照してください。

## トップレベル

```sh
formulon <command> [options] [--] <argument>
formulon <command> --help
formulon --version
formulon --help
```

`<command>` は `eval`、`recalc`、`dump`、`paginate` のいずれかです。どのコマンドも位置引数を 1 つだけ取り（`eval` は数式、それ以外は入力パス）、次の共通オプションを受け付けます。

| オプション | 効果 |
| --- | --- |
| `--profile <id>` | Excel の挙動プロファイル。既定値は `win-365-en_US` で、28 個の ID から選ぶ。不明な ID は使い方エラーになり、対応する ID の一覧を表示する |
| `--now <date[Thh:mm:ss]>` | `NOW()`、`TODAY()`、相対日付フィルターをローカル時刻に固定する。形式は `YYYY-MM-DD`（0 時）または `YYYY-MM-DDThh:mm:ss` で、範囲は 1900-01-01 から 9999-12-31。保存するワークブックには記録しない |
| `-h`、`--help` | そのコマンドの使い方を stdout に出して `0` で終了 |
| `--version` | エンジンのバージョンを出して `0` で終了 |
| `--` | オプション解析を終える。次のトークンは `-` で始まっていても位置引数として扱う |

オプションは位置引数の前後どちらにも置けますが、`--` の後には置けません。値を取るオプションを繰り返すと、後の値で置き換わります。診断メッセージは `formulon: <command>:` を先頭に付けて stderr に出力します。

## 終了コード

セル単位の Excel エラーは失敗ではなく、正常な結果です。コマンドはその値を stdout に出力して `0` で終了します。

| コード | 意味 |
| --- | --- |
| `0` | 成功。`#DIV/0!` や `#NAME?` などの Excel エラーになった数式も含む |
| `64` | 使い方エラー。不明なフラグ、位置引数の不足や過剰、不正なオプション値、`-o` の指定漏れ |
| `1` | エンジン、ファイル入出力、stdout への書き込みの失敗 |

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
formulon eval [--json] [--repeat N] [共通オプション] [--] <formula>
```

`Sheet1!A1` を評価の基準とする新規ワークブックで、1 つの数式を評価します。先頭の `=` の有無は問いません。

| フラグ | 効果 |
| --- | --- |
| `--json` | プレーンテキストではなく JSON で出力 |
| `--repeat N` | 同じ式を `N` 回（正の整数）評価し、`formulon: eval: N iterations in <t>us` を stderr に出力 |

```sh
formulon eval '=SUM(1,2,3)'        # → 6
formulon eval --json '=1/0'         # → {"kind":"error","value":"#DIV/0!"}
formulon eval '=SUM('               # → #NAME?（stdout、exit 0）
formulon eval --profile mac-365-de_DE --now 2026-10-09T09:30:00 '=NOW()'
formulon eval '=SEQUENCE(2,2)'       # → タブ区切りの 2 行: 1\t2 と 3\t4
formulon eval --json '=SEQUENCE(2,2)' # → 型付き値オブジェクトの入れ子配列
```

プレーンテキストでは結果の 1 行を 1 行に出力し、セルをタブで区切ります。値の中の制御文字は `dump` と同じく JSON 形式のバックスラッシュエスケープ（`\t`、`\n`）になります。`--json` では、1×1 の結果は `{"kind": ..., "value": ...}` のオブジェクト 1 つ、それより大きい結果はそのオブジェクトを行優先で並べた配列の配列です。`kind` は `blank`、`number`、`bool`、`text`、`error`、`array`、`ref`、`lambda` のいずれかで、blank・array・ref・lambda の `value` は `null` です。

構文が不正でもコマンドの失敗にはなりません。`eval` は `#NAME?` を出力して `0` で終了するため、数式の打ち間違いを拒否したいスクリプトは出力を確認してください。ホスト API は扱いが異なり、`setFormula()` は不正なテキストを `kParserUnexpectedToken` として拒否します。

## `recalc`

```sh
formulon recalc [--iterative] [--threads N] [--quiet] [共通オプション] <in.xlsx-or-xlsb> -o <out.xlsx-or-xlsb>
formulon recalc [--iterative] [--threads N] [--quiet] [共通オプション] -o <out.xlsx-or-xlsb> -- <in.xlsx-or-xlsb>
```

ワークブックを読み込んで再計算し、新しいワークブックを書き出します。

| フラグ | 効果 |
| --- | --- |
| `-o`、`--output PATH` | 必須。空でない出力パスを指定し、`--` より前に置く |
| `--iterative` | 意図的な循環参照のために反復計算を有効にする。ワークブックの最大反復回数と収束しきい値はそのまま使う |
| `--threads N` | 並列スケジューラを使う。`0` は最大 8 ワーカーの自動検出、`1` は呼び出し元スレッドだけで実行、`2..8` はワーカー数の上限。それ以外の値は使い方エラー。指定しなければ直列に再計算する |
| `--quiet` | 成功時のステータス行を出さない。損失の警告は表示する |

出力コンテナは `-o` の拡張子で決まります。`.xlsb` なら MS-XLSB、それ以外（拡張子なしを含む）は OOXML の `.xlsx` を書き出します。入力形式は拡張子ではなくバイト列から判別します。

書き込みはアトミックです。一時ファイルに書き、再計算と保存が成功してから対象を置き換えるため、失敗しても既存の対象ファイルは壊れません。

成功すると、`recalc` は `formulon: recalc: ok, wrote <n> bytes to '<out>'` を stderr に出力します。`--threads` を指定した場合は、この行にスケジューラの統計（`threads`、`cells_evaluated`、`sccs_processed`、`parallel_steps`、`serial_fallback_steps`、`cycle_recoveries`、`worker_threads_started`、`worker_threads_used`）も入ります。stdout には何も出力しません。

## `dump`

```sh
formulon dump [--formulas|--values|--sheets|--metadata] [共通オプション] [--] <in.xlsx-or-xlsb>
```

4 つのモードは同時に指定できません。各行の制御文字は `eval` と同じ方法でエスケープします。

| モード | 出力 |
| --- | --- |
| `--formulas`（既定） | すべての数式セルを `Sheet!A1 =formula` の形で、シートごとに `(row, col)` 順に出力。再計算しない |
| `--values` | 再計算したうえで、空でないすべてのセルを `Sheet!A1 <表示値>` の形で出力 |
| `--sheets` | シート名を文書順に 1 行ずつ出力 |
| `--metadata` | `[defined_names]`、`[tables]`、`[passthrough_parts]` の 3 セクション。空のセクションも見出しは出力する。再計算しない |

`--metadata` では、シートに属する名前を `Sheet!Name formula`、テーブルを `name display_name sheet_index ref` の形で出力します。

## `paginate`

```sh
formulon paginate [--sheet INDEX] [共通オプション] [--] <in.xlsx-or-xlsb>
```

指定したシートの印刷範囲、自動改ページ、物理ページ数を解決します。`INDEX` の既定値は `0` で、シート番号と出力座標はすべて 0 始まりです。印刷範囲は両端を含みます。

出力は行単位です。

```text
sheet=0
pages=2
print_area=0:0-49:7
horizontal_breaks=25
vertical_breaks=4
```

印刷範囲や改ページ位置が複数ある場合はカンマで区切ります。改ページがないシートでは値が空になります（`horizontal_breaks=`）。

## 損失の警告 {#loss-warnings}

`recalc`、`dump`、`paginate` は、読み込んだワークブックの読み込み時の損失カウンターが 0 でない場合に stderr へ警告を出します。`recalc` は保存したファイルの書き出し時の損失カウンターも報告します。出力するのは 0 でないカウンターだけで、警告によって終了コードは変わりません。

| 警告行 | カウンター |
| --- | --- |
| `formulon: <command>: warning: XLSB read diagnostics` | `undecoded_formula_count`、`undecoded_defined_name_count`、`undecoded_part_count` |
| `formulon: <command>: warning: OOXML read diagnostics` | `skipped_feature_count`、`unknown_content_type_count` |
| `formulon: recalc: warning: XLSB write diagnostics` または `OOXML write diagnostics` | `downgraded_formula_count`、`deferred_feature_count`、`dropped_part_count`、`dropped_relationship_count`、`renumbered_part_count` |

パートを破棄すると、そのパートを指す関連付けも破棄されます。そのため `dropped_part_count` と `dropped_relationship_count` は同じ損失を表す場合があり、合計してはいけません。カウンターが対象とする損失は [コンテナ形式](/ja/api/wasm#container-format) に挙げたものだけです。

## 次に読むもの

- [CLI ワークフロー](/ja/runtimes/cli) ─ シェルパイプラインへの組み込み
- [CI でワークブック回帰検査](/ja/scenarios/ci-regression) ─ CI 例
