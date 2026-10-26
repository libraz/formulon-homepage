# コメントと画像

ワークブックモデルは、セルノート、スレッド形式の議論、人物、描画オブジェクト（画像、グラフ、図形、テーブルスライサー）を分けて扱います。スパークライングループは描画の隣にあるワークシート拡張リストに入っているため、このページで扱います。グラフも描画オブジェクトであり、以下の描画用メソッドはグラフにも使えます。グラフの内容は[グラフ](/ja/workbook/charts)を参照してください。API は保存済みメタデータとメディアのバイト列を公開しますが、描画は行いません。

## スレッド形式のコメントと人物

`getThreadedComments(sheet)` はファイル内の順序で平坦化したリストを返します。各スレッドの開始コメントの直後に返信が並びます。`ThreadedComment` は ID、0 始まりのアンカー、人物 ID、時刻、本文、親 ID、解決状態、UTF-16 単位のメンション範囲を持ちます。`getPersons()` はワークブックの人物リストを読み取ります。`addThreadedComment` は `parentId` が空ならスレッドを開始し、それ以外なら返信を追加します。`editThreadedComment`、`setThreadResolved`、`removeThreadedComment` でコメントを更新・削除できます。開始コメントを削除するとスレッド全体を削除します。コメントやメンションが参照している人物は `removePerson` で削除できません。

各スレッドは Excel の従来型ノートのスタブと同期します。行や列を挿入または削除すると、コメントのアンカーもセルと同じ規則で移動または削除されます。従来型ノートには `getComment`、`getComments`、`setComment` を使います。`setComment` に空の `text` を渡すとノートを削除します。`getComments(sheet)` は値のないセルに付いたノートも返し、Python には `comment_count(sheet)` もあります。`getComment()` はノートがない場合も不正なシートの場合も `null` を返します。WASM と Native Node では、`getCommentResult(sheet, row, col)` で両者を区別できます。

`getCommentVisible(sheet, row, col)` は、ノートがホバーなしで表示されているかを返し（`value` は 0 または 1）、`setCommentVisible(sheet, row, col, visible)` はノートのボックスの位置情報を保ったまま表示・非表示を切り替えます。どちらも、そのセルにノートがない場合は `kNotFound` で失敗します。Python では、`get_comment_visible()` はブール値を返し、ノートがなければ `None` を返します。`set_comment_visible()` は例外を送出します。再保存では、各ノートのボックス（`x:Anchor`）、表示状態、コメントパーツの作成者テーブルが保持され、どのノートからも参照されていない作成者も残ります。ノートの追加、削除、表示を行うと、他のノートのボックスや表示状態をリセットせずに描画を再生成し、ボックスは行・列の編集でノートに追随します。残る各ノートは、元の `<v:shape>`（塗り、線、影、テキストボックスのスタイル、フォント、サイズ）をそのまま出力し、アンカー、表示状態、セルだけを書き換えます。新しいノートには既定の図形が付きます。

C の呼び出しは `fm_sheet_threaded_comment_count`、`fm_sheet_threaded_comment_at`、`fm_sheet_add_threaded_comment`、`fm_sheet_edit_threaded_comment`、`fm_sheet_set_thread_resolved`、`fm_sheet_remove_threaded_comment`、`fm_workbook_person_count`、`fm_workbook_person_at`、`fm_workbook_add_person`、`fm_workbook_remove_person` です。WASM と Native Node は対応する camelCase、Python は snake_case のメソッドを使います。

## 画像のバイト列と描画アンカー {#drawing-anchors}

`probeImage(bytes)` は PNG、JPEG、GIF、BMP のバイト列を判定し、ワークブックを変更せずに `ImageFormat` とピクセル寸法を返します。`listDrawingObjects(sheet)` は画像、グラフ、図形、グループ、コネクタなど、描画に含まれるアンカー付きオブジェクトを列挙します。画像のメタデータにはオブジェクト ID、アンカー種別、`AnchorEditAs`、セル座標、EMU 単位（1 ポイント = 12,700 EMU）のオフセットと寸法、名前、説明、メディアパス、画像形式が含まれます。`getImage(sheet, objectId)` は画像バイト列のコピーを返します。

`insertImage` は 1 セルまたは 2 セルのアンカーを受け取ります。既存の絶対位置アンカーは `listDrawingObjects` で読み取れますが、この API から絶対位置アンカーを挿入することはできません。2 セル画像が編集に追随する方法は `AnchorEditAs` で指定します。幅または高さが 0 の場合は、判定したピクセル寸法を EMU に変換して使います。`removeDrawing` は他の描画オブジェクトを残して画像またはグラフを削除します。メディアを参照するオブジェクトがなくなれば、未使用のメディアも削除されます。1 セルおよび 2 セルの画像アンカーは、行や列の挿入・削除に追随します。

`setDrawingAnchor` は、ID、名前、その他の要素（画像ならクロップ、回転、反転）を保ったまま既存の画像またはグラフを移動・サイズ変更します。1 セルまたは 2 セルの配置に対応し、幅または高さが 0 の場合は現在のサイズを保ちます。`setDrawingZOrder` は画像またはグラフを描画オブジェクトのリスト内の位置へ移動します。`0` が背面、最後の位置が前面です。`snapshotDrawing` は、オブジェクトのリスト位置、要素、リレーションシップ、メディアまたはグラフのパーツを含む不透明なバージョン付きバイト列を取得します。`restoreDrawing` は同じ ID のオブジェクトを記録位置へ戻し、`{ newId: true }` を指定すると新しい ID のコピーを前面へ追加します。スナップショットは別のシートへ復元することもできます。解析済みの OOXML 描画が必要で、XLSB から保持された描画では `kIoDrawingUnparseable` になります。

C の呼び出しは `fm_workbook_probe_image`、`fm_sheet_drawing_object_count`、`fm_sheet_drawing_object_at`、`fm_sheet_get_image`、`fm_sheet_insert_image`、`fm_sheet_remove_drawing`、`fm_sheet_set_drawing_anchor`、`fm_sheet_set_drawing_z_order`、`fm_sheet_snapshot_drawing`、`fm_sheet_restore_drawing` です。レンダリングとヒットテストはこの API の対象外です。

::: code-group

```js [WASM]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0))
try {
  console.log(checked(wb.probeImage(png), 'probeImage'))
  const inserted = checked(wb.insertImage(0, png, { row: 0, col: 0, name: 'dot' }), 'insertImage')
  console.log(checked(wb.listDrawingObjects(0), 'listDrawingObjects'))
  console.log(checked(wb.getImage(0, inserted.objectId), 'getImage').bytes.length)
  const snapshot = checked(wb.snapshotDrawing(0, inserted.objectId), 'snapshotDrawing')
  checked(wb.setDrawingAnchor(0, inserted.objectId, { row: 2, col: 0 }), 'setDrawingAnchor')
  checked(wb.setDrawingZOrder(0, inserted.objectId, 0), 'setDrawingZOrder')
  checked(wb.removeDrawing(0, inserted.objectId), 'removeDrawing')
  checked(wb.restoreDrawing(0, snapshot.bytes), 'restoreDrawing')
  checked(wb.removeDrawing(0, inserted.objectId), 'removeDrawing restored picture')
  console.log(checked(wb.getThreadedComments(0), 'threads').comments.length, checked(wb.getPersons(), 'persons').persons.length)
} finally { wb.delete() }
```

```js [Native Node]
import { Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0))
try {
  console.log(checked(wb.probeImage(png), 'probeImage'))
  const inserted = checked(wb.insertImage(0, png, { row: 0, col: 0, name: 'dot' }), 'insertImage')
  console.log(checked(wb.listDrawingObjects(0), 'listDrawingObjects'))
  console.log(checked(wb.getImage(0, inserted.objectId), 'getImage').bytes.length)
  const snapshot = checked(wb.snapshotDrawing(0, inserted.objectId), 'snapshotDrawing')
  checked(wb.setDrawingAnchor(0, inserted.objectId, { row: 2, col: 0 }), 'setDrawingAnchor')
  checked(wb.setDrawingZOrder(0, inserted.objectId, 0), 'setDrawingZOrder')
  checked(wb.removeDrawing(0, inserted.objectId), 'removeDrawing')
  checked(wb.restoreDrawing(0, snapshot.bytes), 'restoreDrawing')
  checked(wb.removeDrawing(0, inserted.objectId), 'removeDrawing restored picture')
  console.log(checked(wb.getThreadedComments(0), 'threads').comments.length, checked(wb.getPersons(), 'persons').persons.length)
} finally { wb.dispose() }
```

```python [Python]
from formulon import FormulonError, Workbook

png = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da6364f80f00010501012718e3660000000049454e44ae426082')
try:
    with Workbook.create_default() as wb:
        print(wb.probe_image(png))
        object_id = wb.insert_image(0, png, row=0, col=0, name='dot')
        print(wb.list_drawing_objects(0))
        print(len(wb.get_image(0, object_id)))
        snapshot = wb.snapshot_drawing(0, object_id)
        wb.set_drawing_anchor(0, object_id, row=2, col=0)
        wb.set_drawing_z_order(0, object_id, 0)
        wb.remove_drawing(0, object_id)
        wb.restore_drawing(0, snapshot)
        wb.remove_drawing(0, object_id)
        print(len(wb.get_threaded_comments(0)), len(wb.get_persons()))
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

従来型ノート、スレッドコメント、OOXML の描画（読み込んだ画像と挿入画像を含む）は XLSB 保存時に省略します。`deferredFeatureCount` で省略を報告しますが、描画は画像ごとではなくシートの描画先ごとに 1 件と数えます。保持済みの互換性のある XLSB 描画パーツはそのまま出力する場合があります。詳しい制限は [ファイル形式](/ja/workbook/file-formats) を参照してください。従来型ノートの本文と再生成されるコメント VML のジオメトリは Excel に近似します。

## 描画の図形

`listShapes(sheet)` は、シートの描画に含まれる `xdr:sp` の図形とテキストボックス、`xdr:cxnSp` の線とコネクタ、`xdr:grpSp` のグループを、背面から順に列挙します。グループの子は列挙されません。`Shape` は `objectId`、`kind`（`DrawingObjectKind`）、`listDrawingObjects` と同じ形式のアンカー、`name`、`prst`（プリセット図形。カスタム図形やグループでは空）、`text`（段落を `\n` で連結）、`textBox`、`fillKind` と `lineKind`（`ShapePaint`）、`fillRgb` と `lineRgb`（種別が `Solid` のとき 0xRRGGBB）、`lineWidthEmu`（幅がなければ 0）、60000 分の 1 度単位の `rotation`、`hidden` を持ちます。

`insertShape(sheet, spec)` は図形を最前面に追加して ID を返します。描画のないシートには描画が作られ、既存の描画の内容は保持されます。`updateShape(sheet, objectId, spec)` は `spec` に指定したフィールドだけを適用し、図形の XML の残りはそのまま保ちます。`removeShape(sheet, objectId)` は図形、コネクタ、グループを子ごと削除します。`spec` で省略したキーと `null` は適用されません。挿入には `anchorKind` が必要で、`prst` の既定は `rect`、`name` の既定は `Shape <id>` です。線やコネクタのジオメトリを `prst` に指定するとコネクタになり、テキストは持てません。`anchorKind` を指定するとアンカー全体（`editAs`、`from*`、`to*`、`cx`、`cy`）が適用され、更新ではアンカー種別を変更できません。入力の `fillKind` と `lineKind` は `Solid` か `None` にする必要があります。レコードで表現できない図形は `ShapePaint.Other` または空のフィールドで列挙され、保存してもそのまま通過します。図形は画像と同様に行・列の編集に追随します。

```ts
const { objectId } = wb.insertShape(0, {
  anchorKind: AnchorKind.TwoCell,
  fromRow: 1, fromCol: 1, toRow: 4, toCol: 4,
  prst: 'roundRect',
  text: 'Review',
  fillKind: ShapePaint.Solid, fillRgb: 0xfff2cc,
})
wb.updateShape(0, objectId, { text: 'Approved', rotation: 0 })
```

Python では `insert_shape()` と `update_shape()` に同じフィールドをキーワード引数（`anchor_kind`、`from_row`、`fill_kind` など）で渡し、`list_shapes()` は `Shape` のリストを返します。C の呼び出しは `fm_sheet_shape_count`、`fm_sheet_shape_at`、`fm_sheet_insert_shape`、`fm_sheet_update_shape`、`fm_sheet_remove_shape` で、レコードは `fm_shape` です。

## テーブルスライサー

`listSlicers(sheet)` は、シートが持つテーブルスライサーを列挙します。各スライサーは、`name`、`caption`、スライサーキャッシュ（`cacheName`）、`tableName` と `columnName`、`style`、`columnCount`、`rowHeight`（EMU）、`sortOrder`（`SlicerSortOrder`）、`crossFilter`（`SlicerCrossFilter`）、アンカー、そしてシートの描画内のフレームの ID である `objectId` を持ちます。スライサーはこのリスト内の位置で指定し、追加や削除をすると後ろの番号がずれます。選択状態はスライサーではなくテーブルの AutoFilter に保存されます。ピボットキャッシュに接続したスライサーは、保存時にそのまま通過し、列挙されません。

`addSlicer(sheet, table, column, spec)` は、ワークブック全体で数えたテーブル番号（`tableAt` を参照）の 0 始まりの列に対するスライサーを作成します。テーブルは別のシートにあってもかまいません。スライサーとキャッシュのパーツ、リレーションシップ、コンテンツタイプ、`Slicer_*` の定義名、描画フレームがまとめて作られます。`spec` にはアンカーが必要で（`fromRow` を指定すると 2 セルアンカー全体が適用されます）、`name` と `caption` の既定は列名、`rowHeight` の既定は 241300 EMU、`columnCount` の既定は 1 です。`updateSlicer(sheet, index, spec)` はキャプション、スタイル（空文字列で削除）、項目の列数、行の高さ、並べ替え順、クロスフィルター、アンカーを変更しますが、名前は変更できません。`removeSlicer(sheet, index)` はスライサーをフレームごと削除し、それを使うスライサーがなくなればキャッシュも削除します。最後の描画オブジェクトだった場合は、シートの描画も削除します。テーブルやシートの削除、スライサーのフレームの下にある行・列の削除でも、それに結び付いたスライサーが同じように削除されます。読み込んだスライサーは、すべてのパーツとともに再保存で保持され、フレームは行・列の編集に追随します。`.xlsx` から読み込んだテーブルスライサーは `.xlsb` に書き出されず、`deferredFeatureCount` に計上されます。

Python では `list_slicers()`、`add_slicer()`（`anchor` 引数を取ります）、`update_slicer()`、`remove_slicer()` を使います。C の呼び出しは `fm_sheet_slicer_count`、`fm_sheet_slicer_at`、`fm_sheet_add_slicer`、`fm_sheet_update_slicer`、`fm_sheet_remove_slicer` で、レコードは `fm_slicer` です。

## スパークライングループ

`listSparklineGroups(sheet)` は、シートのワークシート拡張リストにある `x14:sparklineGroups` を、文書内の順序で列挙します。`SparklineGroup` は、`type`（`SparklineType`: `Line`、`Column`、`Stacked`）、系列・負の値・軸・マーカー・先頭・末尾・最高・最低の各色、対応する `markers`、`high`、`low`、`first`、`last`、`negative` の切り替え、`displayXAxis`、`displayHidden`、軸のスケール（`minAxisType`、`maxAxisType`、`manualMin`、`manualMax`）、日付軸（`dateAxis`、`dateAxisRef`）、`lineWeight`、`emptyCellsAs`、`sparklines` を持ちます。各 `Sparkline` は、データの `formula`（`=` なしのシート修飾付き範囲）と、それを表示する 1 つの A1 形式の `location` セルです。`kind` が 0 の色は未設定で、境界値が設定されていない `manualMin` / `manualMax` は `null` です。

`addSparklineGroup(sheet, spec)` はグループを末尾に追加します。`spec.sparklines` には 1 つ以上のスパークラインが必要で、省略した他のフィールドは新規の折れ線グループの既定値になります。`updateSparklineGroup(sheet, index, spec)` は、モデル化された属性、色、日付範囲を書き換え、グループのスパークラインと、モデル化されていない属性や子要素（`rightToLeft`、`uid`、未知の拡張）を保持します。`setSparklineGroupSparklines(sheet, index, sparklines)` はグループのスパークラインを置き換え、`removeSparklineGroup(sheet, index)` はグループを削除します。グループは位置で指定し、追加や削除をすると後ろの番号がずれます。Python では `list_sparkline_groups()`、`add_sparkline_group()`、`update_sparkline_group()`、`set_sparkline_group_sparklines()`、`remove_sparkline_group()` を使います。C の呼び出しは `fm_sheet_sparkline_group_count`、`fm_sheet_sparkline_group_at`、`fm_sheet_sparkline_at`、`fm_sheet_add_sparkline_group`、`fm_sheet_update_sparkline_group`、`fm_sheet_set_sparkline_group_sparklines`、`fm_sheet_remove_sparkline_group` です。スパークライングループは `.xlsb` にも書き出されますが、参照をエンコードできないグループは書き出されず、`deferredFeatureCount` に計上されます。
