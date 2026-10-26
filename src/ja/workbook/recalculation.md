# 再計算

再計算はワークブックの編集を更新済みの計算値へ反映する工程です。WASM・Python・Native Node・CLI・MCP のいずれも同じ再計算コアを経由するため、実行入口による挙動のずれは起きない設計になっています。

::: info 用語: dependency graph（依存関係グラフ）
数式から構築される有向グラフです。各数式セルは参照しているセル・定義名・外部リンクを指しており、エンジンはこれを使って計算順序を決めます。
:::

::: info 用語: dirty cell（再計算待ちのセル）
依存先の値が変わったため、計算値が古い可能性があるとエンジンがマークしたセルです。全体再計算はこの集合を評価して再計算済みに戻します。
:::

::: info 用語: 揮発性関数 (volatile function)
引数以外のもの（時刻、乱数、ワークブックの構造など）に値が依存する関数です。引数が変わらなくても再計算のたびに評価され、依存先のセルも毎回再計算待ちにします。
:::

## エンジンが管理する状態

| 状態 | 用途 |
| --- | --- |
| 依存関係グラフ | 数式セル・定義名・テーブル・外部リンク間の前向き / 後ろ向きエッジ |
| 再計算待ちのセル（dirty） | 読み取り前に再評価が必要なセル |
| 揮発性関数 | `NOW` / `TODAY` / `RAND` / `RANDBETWEEN` / `RANDARRAY` / `OFFSET` / `INDIRECT` / `INFO` / `CELL` / `FORMULATEXT` / `SHEET` / `SHEETS`。常に再計算待ちとして扱います |
| ワークブックの時計 | `NOW`、`TODAY`、ピボットの相対期間フィルターで共有する任意の現地時刻 |
| 反復計算の設定 | 循環参照を許容するための反復計算の有効化・最大回数・収束しきい値 |
| 動的配列のスピル形状 | 起点セルごとの結果形状。依存セルの再形状・無効化に使います |
| 計算モード | Excel の自動 / 手動 / 自動（データテーブル以外）の設定。往復保存のために保持するだけで、モードに関係なく、エンジンはホストが `recalc()` か `partialRecalc()` を呼んだときだけ再計算します。`recalc()` の計算内容を変えるのは `AutoNoTable` だけで、[データテーブル](#what-if-data-tables)を飛ばします |
| データテーブル | What-If の `TABLE()` の範囲。処理対象があった `recalc()` の後で再計算されます |

<DiagramLayers :layers="[
  { title: '編集', nodes: [{ label: '編集 / set_cell' }, { label: '揮発性関数', note: 'NOW・RAND・INDIRECT・…' }] },
  { title: '再計算待ちの追跡', nodes: [{ label: '再計算待ちのマーク', note: '依存関係グラフを逆向きに辿る' }] },
  { title: '再計算', nodes: [{ label: 'recalc / partialRecalc', note: '全体または要求された依存関係を評価' }] },
  { title: 'セル単位', nodes: [{ label: '通常の結果', note: '値を書き込む' }, { label: '動的配列', note: 'スピル形状を更新し、依存先を無効化' }] },
  { title: '完了', nodes: [{ label: '再計算済みに戻す', note: '全体再計算ならすべての待機セルを処理し、部分再計算なら要求範囲を最新にする' }] }
]" />

この依存関係グラフは読み出すこともできます。`precedents(sheet, row, col, depth)`（Python でも同じ名前）は参照元のセルを、`dependents(...)` は参照先のセルを返します。下のパネルであらかじめ数式を並べたシートのセルを選ぶと、矢印はこの 2 つの呼び出しが返したアドレスだけから描かれます。`depth` を上げていくと、`D1` の背後にある依存の連鎖を 1 列ずつ遡り、最終的に A 列の定数まで辿れます。

<TraceDemo />

## 全体再計算と部分再計算

`recalc()` はすべての再計算待ちセルをトポロジカル順で再評価します。セルは決まった順序で訪問されるため、スピルの勝者や従来の配列ブロックは実行のたびに同じ結果になります。`partialRecalc()` は WASM・Native Node・Python のいずれでも使え、指定した表示範囲を最新にするために必要な数式セルと、その数式が参照する先行セルを再計算します。依存関係の外にある再計算待ちセル（直前に再計算したセルを参照する依存セルを含む）は、古いキャッシュ値を保持したまま再計算待ちとして残ります。後で全体再計算を行うか、そのセルを含む依存関係の範囲を部分再計算すると更新されます。表示したい出力セルを viewport に指定し、ワークブック全体を更新するときは `recalc()` を使ってください。

範囲の境界は両端を含みます。たとえば `B1` が `A1` を、`C1` が `B1` を参照している場合、`A1` の編集後に `B1:C1` を指定すると、表示する 2 セルとその先行セルが更新されます。

::: code-group

```ts [WASM / Native Node]
const result = wb.partialRecalc({
  sheet: 0, firstRow: 0, lastRow: 0, firstCol: 1, lastCol: 2,
})
if (!result.status.ok) throw new Error(result.status.message)
console.log(`recomputed ${result.recomputed} cell(s)`)
```

```python [Python]
recomputed = wb.partial_recalc(
    sheet=0, first_row=0, last_row=0, first_col=1, last_col=2,
)
print(f"recomputed {recomputed} cell(s)")
```

:::

## 時計に依存する計算の固定

ワークブックに固定した時計がない場合、`NOW()`、`TODAY()`、ピボットの相対期間フィルターはホストの時計を読み取ります。読み取りごとに別の時刻になる可能性があり、日付が変わる境界では 1 回の再計算の中でも結果が一致しないことがあります。固定時刻を設定すると、すべてが 1 つの現地時刻を共有して再現可能な再計算になります。

WASM と Native Node では `pinnedNow()`、`setPinnedNow(year, month, day, hour, minute, second)`、`clearPinnedNow()` を使います。Python では対応する `pinned_now()`、`set_pinned_now(...)`、`clear_pinned_now()` を使い、CLI では `--now <date[Thh:mm:ss]>` を指定します。JavaScript の getter は `{ status, now }` を返すため、`now` を読む前に `status` を確認してください。`now` は `CivilTime`（`year`、`month`、`day`、`hour`、`minute`、`second`）またはホストの時計を使う状態で `null` です。Python は `CivilTime` または `None` を直接返します。

```ts
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
checkStatus(wb.setPinnedNow(2026, 8, 19, 12, 0, 0))
checkStatus(wb.recalc())
const pin = wb.pinnedNow()
if (!pin.status.ok) throw new Error(pin.status.message)
const now = pin.now
checkStatus(wb.clearPinnedNow())
```

固定時刻はタイムスタンプではなく現地時刻の各フィールドとして保持するため、タイムゾーンの解釈はありません。`setPinnedNow()` は 1900–9999 の範囲外の年、1–12 の範囲外の月、その月に存在しない日、0–23 の範囲外の時、0–59 の範囲外の分 / 秒を拒否し、不正な値を別の日付へ繰り上げません。固定時刻の設定・解除はすべての数式セルを再計算待ちにし、依存する派生ピボット結果を消去しますが、`recalc()` を実行するまではキャッシュ値を再計算しません。固定時刻はファイル状態ではなくモデル状態です。保存時には記録されず、読み込み直後のワークブックは固定されていないためホストの時計に従います。

## ワークブック全体の無効化

反復計算の設定、Excel 互換性プロファイル、固定時計を変更すると、すべての数式セルを再計算待ちにします。コンテキストに依存する変更では、それに依存する派生ピボット結果も消去します。数式と依存するピボット結果を更新するには `recalc()` を呼び出してください。実効値が同じ設定は何もしません。

## 計算設定の保存

計算モード（`calcMode()` / `setCalcMode()`。値は `CalcMode.Auto`、`Manual`、`AutoNoTable`。Python では `calc_mode()` / `set_calc_mode()`）と反復計算の設定は、ワークブックを開いている間の状態です。ホストの UI にモードを表示することはできますが、`AutoNoTable` 以外ではエンジンはモードに従って動作を変えません。

`<calcPr>` のほかの設定にも型付きのアクセサーがあり、要素の属性はすべて再保存後も保持されます。

| 設定 | WASM / Native Node | Python |
| --- | --- | --- |
| 表示桁数で計算（`fullPrecision`。メタデータのみ） | `fullPrecision()` / `setFullPrecision(value)` | `full_precision()` / `set_full_precision(value)` |
| 保存前に再計算（`calcOnSave`。既定はオン） | `calcOnSave()` / `setCalcOnSave(value)` | `calc_on_save()` / `set_calc_on_save(value)` |
| 参照形式（`refMode`） | `refMode()` / `setRefMode(RefMode.A1 \| RefMode.R1C1)` | `ref_mode()` / `set_ref_mode(mode)` |
| 1904 日付システム（`<workbookPr date1904>`） | `date1904()` / `setDate1904(value)` | `date1904()` / `set_date1904(value)` |

JavaScript のゲッターはフラグを `0` / `1` にした `{ status, value }` を返し、Python は `bool` と `RefMode` を返します。`setDate1904()` は保存済みのシリアル値を変換せずに日付システムを切り替えるため、すべての日付が 1462 日ずれます。

XLSX はこれらを `<calcPr>` と `<workbookPr>` に保存します。XLSB ライターは `BrtCalcProp` と `BrtWbProp` として出力するので、手動計算や反復計算の設定はバイナリ保存でも残ります。XLSB が省略するものは [ファイル形式](/ja/workbook/file-formats) を参照してください。

## What-If データテーブル {#what-if-data-tables}

What-If データテーブル（`<f t="dataTable">`）は、値に固定されずモデルとして保持されます。シートは各テーブルの結果範囲・向き・入力セルを保持し、保存時には起点セルに数式を書き戻します。代入する値は結果範囲の上の行と左の列に置きます。1 変数テーブルは行入力セルか列入力セルのどちらかを持ち、2 変数テーブルは両方を持ちます。

`recalc()` は、各値を入力セルに代入し、それを参照するセルを再計算して入力を元に戻す手順で結果セルを埋めます。`CalcMode.AutoNoTable` のときは `recalcDataTables()`（`recalc_data_tables()`）を呼ぶまで結果セルに触れません。この呼び出しはモードに関係なく、すべてのテーブルをその場で計算します。`partialRecalc()` はデータテーブルを計算しません。

::: code-group

```ts [WASM / Native Node]
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
// 列入力セル B1 に A3:A5 の値を代入し、B3:B5 に =B1*2 の結果を入れる
checkStatus(wb.setNumber(0, 0, 1, 10)) // B1
checkStatus(wb.setFormula(0, 1, 1, '=B1*2')) // B2（数式の行）
for (const [i, v] of [1, 2, 3].entries()) checkStatus(wb.setNumber(0, 2 + i, 0, v))
checkStatus(wb.addDataTable(0, {
  firstRow: 2, lastRow: 4, firstCol: 1, lastCol: 1,
  colInput: { row: 0, col: 1 },
}))
checkStatus(wb.recalc())
const found = wb.getDataTable(0, 3, 1)
console.log(found.dataTable?.twoDimensional) // false
```

```python [Python]
wb.set_number(0, 0, 1, 10)  # B1（列入力セル）
wb.set_formula(0, 1, 1, "=B1*2")  # B2（数式の行）
for i, v in enumerate([1, 2, 3]):
    wb.set_number(0, 2 + i, 0, v)
wb.add_data_table(0, 2, 1, 4, 1, col_input=(0, 1))  # first_row, first_col, last_row, last_col
wb.recalc()
print(wb.get_data_table(0, 3, 1).two_dimensional)  # False
```

:::

- `addDataTable(sheet, spec)` / `add_data_table(...)` は結果範囲にテーブルを作ります。範囲の上に行、左に列が必要で、入力セルは範囲の外になければなりません。満たさない場合や、別のテーブルと重なる場合は `kDataTableInvalid`（8005）で失敗します。結果セルは次の再計算まで `0` を返します。
- `getDataTable(sheet, row, col)` / `get_data_table(...)` は、結果範囲にそのセルを含むテーブルを読み取ります（該当がなければ `dataTable` は `null`、Python は `None`）。`removeDataTable(...)` はテーブルを削除し、結果セルを空にします。
- 結果範囲へのセル書き込みは `kPreconditionFailed`（「cannot change part of a data table」）で拒否されます。結果範囲、または見出しの行・列に食い込む行・列の挿入と削除も同じステータスで拒否されます。ブロック全体を削除するとテーブルも削除されます。外側の編集では範囲と入力セルが移動します。
- 入力セルを削除すると、その入力は `deleted` になり、テーブルは `#REF!` に評価されます。
- 結果セルは、数式ゲッターでは `=TABLE(row_input,col_input)` と報告されます。`FORMULATEXT` は配列数式と同様に `{=TABLE(...)}` を返し、`ISFORMULA` は `TRUE` です。

データテーブルは XLSX と XLSB の両方で往復保存でき、XLSB では `BrtTable` として書き出されます。

## 存在しないシートへの参照を回復する

参照先のシートが存在しない状態で入力した数式は、最初は `#REF!` になります。そのシートを追加するか、既存のシートを参照名へ変更すると、影響を受ける数式を再解析して依存関係を再構築します。値を書き込んだ後に `recalc()` を呼ぶと結果が得られ、その後の編集も依存関係に従って伝播します。直接参照、範囲、3-D 範囲、定義名の別名、スピル参照が回復対象で、無関係なスピルは保持されます。

## `INDIRECT` と R1C1 参照

`INDIRECT(ref_text, FALSE)` は `ref_text` を R1C1 文字列として解析します。絶対参照は `R5C2` のように書き、相対軸は `R[-1]C` のように数式を置いたセルを基準に解決します。`R` または `C` だけを指定すると現在の行または列を表し、1 軸だけを持つ端点はもう一方の軸全体を対象にします（`R5` は `5:5` と同じく 5 行全体です）。`a1` 引数はフォールバックを追加するのではなく文法を選択するため、`FALSE` に A1 文字列を渡した場合と、`TRUE` に R1C1 文字列を渡した場合は `#REF!` になります。相対 R1C1 文字列を、基準となる数式セルを持たないアドホック評価入口から評価した場合も `#REF!` になります。

## 反復計算

利息計算や goal-seek のように意図的な循環参照を持つワークブックでは反復計算を有効にします。エンジンは独立した循環部分をまとめて走査し、ワークブック全体の変化量を判定します。最大変化量が許容値を下回るか上限回数に達した時点で停止します。

::: code-group

```ts [WASM / Native Node]
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
checkStatus(wb.setIterative(/*enabled*/ true, /*maxIterations*/ 100, /*maxChange*/ 0.001))
checkStatus(wb.setIterativeProgress((iteration, maxResidual) => {
  console.log(`iteration ${iteration}, max residual ${maxResidual}`)
  return true // false で計算を中断
}))
checkStatus(wb.recalc())
```

```python [Python]
wb.set_iterative(True, 100, 0.001)  # enabled, max iterations, max change
wb.recalc()
print(wb.get_iterative())
```

:::

`setIterativeProgress()` は、循環しているセルを 1 回走査するたびに呼ばれるコールバックを登録します。上限そのものは `setIterative()` の第 2・第 3 引数で指定します。このコールバックは WASM と Native Node でのみ使えます。コールバックはソルバーがワークブックを走査途中で保持している間に実行されるため、そのワークブックのメソッドを呼んではいけません。読み取りを含め、呼び出すと `kGraphRecalcReentrant`（4005）を示す `TypeError` が投げられ、何も変更されません。Python の `set_iterative()` は同じ 3 引数を受け取り、`set_iterative_enabled(enabled)` は保存済みの上限を保ったまま反復計算だけを切り替えます。

WASM と Native Node の `getIterative()` は `{ status, enabled, maxIterations, maxChange }` を返します。Python の `get_iterative()` は `enabled`、`max_iterations`、`max_change` を持つ `IterativeSettings` レコードを直接返し、失敗時は `FormulonError` になります。`maxIterations` を設定すると値は `32767` までに制限され、getter は制限後の値を返します。読み込んだワークブックの `iterateCount` がそれを超えている場合も同じ上限が適用されます。ホスト UI に実際に使われる値を表示するときは、設定後に読み戻してください。

`maxChange` は有限かつ 0 以上である必要があります。それ以外は API が `kInvalidArgument` を返し、Python では `FormulonError` になります。JavaScript の両バインディングでは `maxIterations` を符号付き 32 ビット整数として渡し、小数、有限でない値、範囲外の値を `RangeError` で拒否します。受け付けた値はその後 `[1, 32767]` に制限されます。Python は `max_iterations` の小数、有限でない値、範囲外の値に `ValueError` を、数値文字列など数値以外の値に `TypeError` を送出します。

::: warning 反復計算を無効にした循環は要確認
反復計算が無効な場合、数式セルが 1 つだけの循環（例: `A1` に `=A1+1`）は `0` を保持し、複数セルを含む循環は `#REF!` になります。`OFFSET` や `INDIRECT` などの動的参照を通る循環では、直前のキャッシュ値が残る場合があります。これらはホスト側の例外ではなく、`recalc()` は成功のステータスを返します。循環参照を意図する場合は反復計算を明示的に有効にしてください。
:::

下のパネルは、ここで説明した 3 つの引数をそのまま操作できる形で、2 セルの循環を解きます。`maxChange` を小さくするほど、そこへ収まるまでの走査回数は増えます。収束に必要な回数より小さい上限を選ぶと解が途中で打ち切られ、最終残差が判定線の上にあるまま未収束として報告されます。

<IterativeDemo />

## 速さより正しさ

すべての再計算は tree-walker で行います。リリース・開発・テストビルドには評価器と評価経路が 1 つだけあります。互換性の判定には Excel から取得したゴールデンデータ（コミット済みの参照値）を使い、これと一致しない速度最適化は受け付けません。

## 次に読むもの

- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・エラー伝播
- [動的配列](/ja/workbook/dynamic-arrays) ─ スピル形状と再計算の関係
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 参照値の取得方法
