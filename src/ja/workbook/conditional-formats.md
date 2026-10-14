# 条件付き書式

Formulon は条件付き書式のルールをワークシートに保持し、求められたときに評価して、ワークブックと一緒に保存します。セルの描画はエンジンの仕事ではありません。`evaluateCfRange()` が各セルで一致したルールと描画内容を返し、ホストがそれをセル自身の書式に重ねて表示します。

::: info 用語: 条件付き書式ルール
ルールは 1 つ以上の範囲（`sqref`）に適用され、種類、条件、優先順位を持ちます。書式ルール（値の比較、数式、上位・下位、文字列の判定など）は **差分書式** を参照します。差分書式はワークブックの `dxf` テーブルに置かれる部分的な書式で、塗りつぶしやフォントの色などを持ち、ルールが一致したセルの書式に重ねられます。視覚ルール（カラースケール、データバー、アイコンセット）は差分書式の代わりに自身の色としきい値を持ちます。どちらのルールも、セルに保存された書式は変更しません。
:::

## しきい値を超える値を強調する

`addDxf()` で塗りつぶしを登録し、それを参照する `cellIs` ルールを追加します。次の例では `A1:A4` のうち 70 を超える値に色を付けます。

::: code-group

```js [JavaScript]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const check = (result) => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  ;[40, 75, 90, 60].forEach((value, row) => check(wb.setNumber(0, row, 0, value)))

  // Light red fill. Set both colours: Excel paints a solid dxf fill with bgColor.
  const red = 0xffffc7ce
  const dxfId = check(wb.addDxf({ fill: { pattern: 1, fgArgb: red, bgArgb: red } })).index

  check(wb.addConditionalFormat(0, {
    sqref: [{ firstRow: 0, firstCol: 0, lastRow: 3, lastCol: 0 }], // A1:A4
    type: 1, // cellIs
    op: 5, // greater than
    formula1: '70',
    dxfId,
  }))

  const hits = check(wb.evaluateCfRange(0, 0, 0, 3, 0, NaN))
  for (const cell of hits.cells) console.log(cell.row, cell.matches[0].dxfId)
  // 1 0
  // 2 0
} finally {
  wb.delete()
}
```

```python [Python]
from formulon import ConditionalFormatInput, DifferentialFormat, FillRecord, MergeRange, Workbook

with Workbook.create_default() as wb:
    for row, value in enumerate([40, 75, 90, 60]):
        wb.set_number(0, row, 0, value)

    # Light red fill. Set both colours: Excel paints a solid dxf fill with bgColor.
    red = 0xFFFFC7CE
    dxf_id = wb.add_dxf(DifferentialFormat(fill=FillRecord(pattern=1, fg_argb=red, bg_argb=red)))

    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=[MergeRange(0, 0, 3, 0)],  # A1:A4
        type=1,  # cellIs
        op=5,  # greater than
        formula1="70",
        dxf_id=dxf_id,
    ))

    for cell in wb.evaluate_cf_range(0, 0, 0, 3, 0):
        print(cell.row, cell.matches[0].dxf_id)
    # 1 0
    # 2 0
```

:::

Native Node（`@libraz/formulon-native`）も WASM パッケージと同じメソッドを持ちます。Python の `ConditionalFormatInput` では、`dxf_id`、`op`、`rank`、`std_dev`、`time_period` が `Optional` です。`None` でない値は保存され、`None` ならその項目は省かれます。ルールが指定していない `ConditionalFormat.op`、`rank`、`std_dev`、`time_period` は `None` で返るため、読み取ったルールをそのまま `add_conditional_format` に渡せます。演算子のない `cellIs` ルールはどのセルにも一致せず、`dxfId` のないルールは適用する書式がないまま一致します。

## 差分書式

`addDxf()` / `add_dxf()` はワークブックの `dxf` テーブルにレコードを追加し、その番号を返します。この番号がルールの `dxfId` です。レコードには `font`、`fill`、`border`、`numFmt`（Python は `font`、`fill`、`border`、`num_fmt_id` / `num_fmt_code`）を必要なものだけ入れます。入れなかった項目は、セルのその部分の書式を変えません。1 つのレコードを複数のルールで共有できます。`getDxf()` / `get_dxf()` でレコードを読み出し、`dxfCount()` / `dxf_count()` でテーブルの件数を取得します。

塗りつぶしは `pattern: 1`（単色）を指定し、色を `fgArgb` だけでなく `bgArgb` にも設定します。Excel は単色の差分書式を背景色で塗るためです。フォントは変更したい項目だけを設定します。太字なら `bold` と `hasBold: true`、文字色なら `colorArgb` です。差分書式のフォントは、`hasSize` が true のときだけ `<sz>` を持ちます。JavaScript では `size` を省略すると `hasSize: false` になり、Python ではサイズのないフォントに `has_size=False` を渡します。サイズのないフォントはセルのサイズを変えません。`size` を持つフォントはレコードと一緒に保存されるので、その場合は既定値の 11 のままにするか、本文フォントのサイズに合わせてください。

## ルールの種類と演算子

`type` は序数です。種類ごとに参照する入力項目が決まっています。

| `type` | ルール | 項目 |
| --- | --- | --- |
| `0` | 数式 | `formula1` |
| `1` | セルの値（`cellIs`） | `op`、`formula1`、範囲指定では `formula2` |
| `2` | カラースケール | `colorScale` |
| `3` | データバー | `dataBar` |
| `4` | アイコンセット | `iconSet` |
| `5` | 上位・下位 N | `rank`、`percent`、`bottom` |
| `6` | 平均より上・下 | `aboveAverage`、`equalAverage`、`stdDev` |
| `7`〜`10` | 指定の文字列を含む、含まない、で始まる、で終わる | `text` |
| `11`〜`14` | 空白、空白以外、エラー、エラー以外 | なし |
| `15` | 日付 | `timePeriod` |
| `16`、`17` | 重複する値、一意の値 | なし |

`cellIs` の演算子 `op` は `0` より小さい、`1` 以下、`2` 等しい、`3` 等しくない、`4` 以上、`5` より大きい、`6` 範囲内、`7` 範囲外の順です。入力規則の `op` とは並びが違います。範囲内・範囲外のルールは、上限と下限をどちらの順で渡しても構いません。

`timePeriod` は `0` 今日、`1` 昨日、`2` 明日、`3` 過去 7 日間、`4` 今週、`5` 先週、`6` 来週、`7` 今月、`8` 先月、`9` 来月です。

数式は先頭の `=` なしで保存され、`formula1` / `formula2` と数式型のしきい値も同じ形（`=$B1>100` ではなく `$B1>100`）で読み戻せます。`==` で始まる数式は拒否されます。数式ルールは、ルールのすべての範囲を囲む外接矩形の左上セルを基準に書き、他のセルでは参照がずれます。たとえば `A1:C10` に `formula1: '$B1>100'` を設定すると、各行の B 列を判定します。空でない数式や数式型のしきい値が解析できない場合は `kParserUnexpectedToken`（1000）で拒否されます。数式なしで追加した文字列、空白、エラー、期間のルールには Excel が保存する数式が設定され、同じセルを基準にして、`formula1` で読み戻せます。「指定の文字列を含む」ルールは `SEARCH` と同じくワイルドカード付きで照合し、「で始まる」「で終わる」ルールは実行中のプロファイルの [照合順序](/ja/compatibility/text-collation) で比較します。ルールを追加せずに 1 つのセルで判定式の結果を確かめるには `evaluateConditionalFormula()` を使います（[アドホック数式評価](/ja/workbook/operations#ad-hoc-formula-evaluation) を参照）。

`priority` はシート全体でのルールの順序で、小さい番号から評価されます。省略するか 0 以下を指定すると、新しいルールは既存のすべてのルールの後ろに入ります。`stopIfTrue` を指定したルールが一致すると、そのセルでは優先順位の低いルールを評価しません。

## 範囲を評価する

`evaluateCfRange(sheet, firstRow, firstCol, lastRow, lastCol, todaySerial)` / `evaluate_cf_range(...)` は、シート上のすべてのルールを両端を含む矩形に対して評価します。ワークブックは変更しません。結果に含まれるのは 1 つ以上のルールに一致したセルだけで、各セルの一致は優先順位順に並びます。

| `kind` | 一致の種類 | 読む項目 |
| --- | --- | --- |
| `0` | 差分書式 | `dxfIdEngaged`、`dxfId` |
| `1` | カラースケール | `color`（RGBA） |
| `2` | データバー | `barLengthPct`、`barAxisPositionPct`、`barIsNegative`、`barFill`、`barBorderEngaged`、`barBorder`、`barGradient`、`barDirection` |
| `3` | アイコンセット | `iconSetName`、`iconIndex` |

JavaScript パッケージはこの値を `CfMatchKind` として公開しています。Python は snake_case の項目名を使い、色を `(r, g, b, a)` のタプルで返します。

`todaySerial` は日付ルールが比較の基準にする日付で、Excel のシリアル値で渡します。`NaN` を渡すと日付ルールは無効になり、どれも一致しません。Python の既定値はこの `NaN` です。`0` では無効になりません。`0` は 1899-12-30 のシリアル値なので、日付ルールはその日付を基準に判定されます。現在のローカル日付を使う場合は次のようにします。

::: code-group

```js [JavaScript]
const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) + 25569
const hits = wb.evaluateCfRange(0, 0, 0, 99, 9, today)
```

```python [Python]
from datetime import date

today = (date.today() - date(1899, 12, 30)).days
hits = wb.evaluate_cf_range(0, 0, 0, 99, 9, today_serial=today)
```

:::

`getEffectiveStyle()` の結果に条件付き書式は含まれません。セルを描画するホストは、一致した差分書式を実効書式の上に自分で重ねます。

## カラースケール、データバー、アイコンセット

視覚ルールは、セルの値がしきい値のどこに位置するかで描画を決めます。しきい値は値オブジェクトで、`type`（`0` 数値、`1` パーセント、`2` 百分位、`3` 最小値、`4` 最大値、`5` 数式、`6` 自動最小値、`7` 自動最大値）、種類に応じて必要な `value` 文字列、`gte` を持ちます。色は各チャンネル 0〜255 の `{ r, g, b, a }` です。Python の `CfColor(r, g, b)` では `a` の既定値が 255 です。

::: code-group

```js [JavaScript]
import createFormulon, { CfMatchKind } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const check = (result) => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  ;[10, 40, 70, 100].forEach((value, row) => check(wb.setNumber(0, row, 0, value)))
  const sqref = [{ firstRow: 0, firstCol: 0, lastRow: 3, lastCol: 0 }]
  const min = { type: 3 }
  const max = { type: 4 }

  check(wb.addConditionalFormat(0, {
    sqref, type: 2, // colorScale
    colorScale: { thresholds: [min, max], colors: [{ r: 248, g: 105, b: 107, a: 255 }, { r: 99, g: 190, b: 123, a: 255 }] },
  }))
  check(wb.addConditionalFormat(0, {
    sqref, type: 3, // dataBar
    dataBar: { min, max, fill: { r: 99, g: 142, b: 198, a: 255 }, direction: 1 },
  }))
  check(wb.addConditionalFormat(0, {
    sqref, type: 4, // iconSet
    iconSet: { name: 0, thresholds: [{ type: 1, value: '33' }, { type: 1, value: '67' }] }, // 3Arrows
  }))

  for (const cell of check(wb.evaluateCfRange(0, 0, 0, 3, 0, NaN)).cells) {
    const parts = cell.matches.map((m) => {
      if (m.kind === CfMatchKind.ColorScale) return `rgb(${m.color.r},${m.color.g},${m.color.b})`
      if (m.kind === CfMatchKind.DataBar) return `bar ${m.barLengthPct.toFixed(1)}%`
      return `icon ${m.iconIndex}`
    })
    console.log(cell.row, parts.join(' | '))
  }
  // 0 rgb(248,105,107) | bar 10.0% | icon 0
  // 1 rgb(198,133,112) | bar 36.7% | icon 1
  // 2 rgb(149,162,118) | bar 63.3% | icon 1
  // 3 rgb(99,190,123) | bar 90.0% | icon 2
} finally {
  wb.delete()
}
```

```python [Python]
from formulon import (CfColor, CfValueObject, ColorScale, ConditionalFormatInput, DataBar, IconSet,
                      MergeRange, Workbook)

with Workbook.create_default() as wb:
    for row, value in enumerate([10, 40, 70, 100]):
        wb.set_number(0, row, 0, value)
    sqref = [MergeRange(0, 0, 3, 0)]
    low, high = CfValueObject(3), CfValueObject(4)  # min, max

    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=sqref, type=2,
        color_scale=ColorScale([low, high], [CfColor(248, 105, 107), CfColor(99, 190, 123)]),
    ))
    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=sqref, type=3,
        data_bar=DataBar(minimum=low, maximum=high, fill=CfColor(99, 142, 198), direction=1),
    ))
    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=sqref, type=4,
        icon_set=IconSet(name=0, thresholds=[CfValueObject(1, "33"), CfValueObject(1, "67")]),
    ))

    for cell in wb.evaluate_cf_range(0, 0, 0, 3, 0):
        color, bar, icon = cell.matches
        print(cell.row, color.color[:3], round(bar.bar_length_pct, 1), icon.icon_index)
    # 0 (248, 105, 107) 10.0 0
    # 1 (198, 133, 112) 36.7 1
    # 2 (149, 162, 118) 63.3 1
    # 3 (99, 190, 123) 90.0 2
```

:::

**カラースケール** には 2 つか 3 つのしきい値と、同じ数の色を渡します。一致結果の `color` は補間後の色です。

**データバー** には `min`、`max`、`fill`（Python は `minimum`、`maximum`、`fill`）を渡し、`showValue` と `minLengthPct` / `maxLengthPct`（既定値は 10 と 90）も指定できます。`x14` 拡張の設定として `gradient`、`axisPosition`（`0` 自動、`1` 中央、`2` なし）、`negativeFill`、`border`、`negativeBorder`、`axisColor`、`direction`（`0` はシートの表示方向に従う、`1` 左から右、`2` 右から左）も持ちます。省略した項目はモデルの既定値になります。既定値はグラデーション、自動の軸、負の値には正の値と同じ塗りつぶし、罫線なし、黒い軸です。一致結果は棒の長さと軸の位置をセル幅に対するパーセントで返し、どちらも左端から測った値です。`barIsNegative` は負の値を示します。右から左のルールと、右から左のシートに置いた `0` のルールでは、ホストが棒を左右反転して描きます。

**アイコンセット** には、アイコンセットの序数 `name` と、N 個のアイコンを分ける、ちょうど N−1 個の `thresholds` を渡します。`Three_Arrows`（`0`）なら 2 つです。個数が違うルールの追加は `kInvalidArgument` で拒否され、読み込んだルールの N−1 を超えるしきい値は評価時に無視されます。序数は OOXML の名前の順で、`0` 3Arrows、`1` 3ArrowsGray、`2` 3Flags、`3` 3TrafficLights1、`4` 3TrafficLights2、`5` 3Signs、`6` 3Symbols、`7` 3Symbols2、`8` 4Arrows、`9` 4ArrowsGray、`10` 4RedToBlack、`11` 4Rating、`12` 4TrafficLights、`13` 5Arrows、`14` 5ArrowsGray、`15` 5Rating、`16` 5Quarters です。`floor` は最も低い区分の下限で、既定値は `percent 0` です。この値を下回るセルにはアイコンが付かず、一致にも含まれません。`iconIndex` は最も低い区分を `0` として数え、`reverse` を指定すると逆順になります。`percent` フラグは保存と読み込みで保持されるだけで、評価には使われません。しきい値の解釈は、それぞれのしきい値の `type` で決まります。

## ルールの読み出しと削除

`getConditionalFormats(sheet)` / `get_conditional_formats(sheet)` は、シート上のすべてのルールを 1 つの平坦な一覧として優先順位順に返します。Python には `cf_count()` と `get_conditional_format_at()` もあります。`addConditionalFormat()` が返す番号は、この一覧での新しいルールの位置です。`removeConditionalFormatAt(sheet, index)` は 1 つのルールを、`clearConditionalFormats(sheet)` はすべてのルールを削除します。ルールを追加・削除すると一覧の番号が振り直されるので、番号を使う前に一覧を読み直してください。

JavaScript では、読み出したルールを視覚ルールの設定も含めてそのまま `addConditionalFormat()` に渡せます。Python が返すのは `ConditionalFormatInput` ではなく `ConditionalFormat` なので、追加し直すときは項目を新しい入力にコピーします。

## 保存と読み込み

ルールは `.xlsx` と `.xlsb` のどちらにも保存されます。ルールが使う差分書式、データバーの `x14` 設定、アイコンセットの下限、読み込んだルールのテーマ色やインデックス色も一緒に保存されます。読み込み後に編集したルールはモデルから書き出されます。行や列を挿入・削除すると、ルールの範囲と数式も移動します。

::: code-group

```js [JavaScript]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const check = (result) => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
const wb = Module.Workbook.createDefault()
let bytes
try {
  const fill = { pattern: 1, fgArgb: 0xffc6efce, bgArgb: 0xffc6efce }
  const dxfId = check(wb.addDxf({ fill })).index
  const sqref = [{ firstRow: 0, firstCol: 0, lastRow: 9, lastCol: 0 }]
  check(wb.addConditionalFormat(0, { sqref, type: 15, timePeriod: 0, dxfId })) // today
  check(wb.addConditionalFormat(0, { sqref, type: 16, dxfId })) // duplicate values
  bytes = check(wb.save()).bytes
} finally {
  wb.delete()
}

const loaded = Module.Workbook.loadBytes(bytes)
try {
  const rules = check(loaded.getConditionalFormats(0))
  console.log(rules.map((r) => `${r.type}:${r.priority}:${r.dxfId}`)) // [ '15:1:0', '16:2:0' ]
  console.log(check(loaded.getDxf(rules[0].dxfId)).fill.bgArgb.toString(16)) // ffc6efce

  check(loaded.removeConditionalFormatAt(0, 0))
  console.log(check(loaded.getConditionalFormats(0)).map((r) => r.type)) // [ 16 ]
  check(loaded.clearConditionalFormats(0))
} finally {
  loaded.delete()
}
```

```python [Python]
from formulon import ConditionalFormatInput, DifferentialFormat, FillRecord, MergeRange, Workbook

with Workbook.create_default() as wb:
    green = 0xFFC6EFCE
    dxf_id = wb.add_dxf(DifferentialFormat(fill=FillRecord(pattern=1, fg_argb=green, bg_argb=green)))
    sqref = [MergeRange(0, 0, 9, 0)]
    wb.add_conditional_format(0, ConditionalFormatInput(  # today
        sqref=sqref, type=15, time_period=0,
        dxf_id=dxf_id,
    ))
    wb.add_conditional_format(0, ConditionalFormatInput(  # duplicate values
        sqref=sqref, type=16, dxf_id=dxf_id,
    ))
    data = wb.save()

with Workbook.load(data) as loaded:
    rules = loaded.get_conditional_formats(0)
    print([(r.type, r.priority, r.dxf_id) for r in rules])  # [(15, 1, 0), (16, 2, 0)]
    print(hex(loaded.get_dxf(rules[0].dxf_id).fill.bg_argb))  # 0xffc6efce

    loaded.remove_conditional_format_at(0, 0)
    print([r.type for r in loaded.get_conditional_formats(0)])  # [16]
    loaded.clear_conditional_formats(0)
```

:::

コンテナごとに何が保持されるかは [ファイル形式](/ja/workbook/file-formats) を参照してください。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ 書式、入力規則、シートごとのその他の構造
- [表示とレイアウト](/ja/workbook/presentation) ─ 実効書式と表示文字列
- [フィルターと入力規則](/ja/workbook/filters-validation) ─ 入力規則のルールモデル
