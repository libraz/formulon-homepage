# コメントと画像

ワークブックモデルは、セルノート、スレッド形式の議論、人物、描画オブジェクトを分けて扱います。API は保存済みメタデータとメディアのバイト列を公開しますが、描画は行いません。

## スレッド形式のコメントと人物

`getThreadedComments(sheet)` はファイル内の順序で平坦化したリストを返します。各スレッドの開始コメントの直後に返信が並びます。`ThreadedComment` は ID、0 始まりのアンカー、人物 ID、時刻、本文、親 ID、解決状態、UTF-16 単位のメンション範囲を持ちます。`getPersons()` はワークブックの人物リストを読み取ります。`addThreadedComment` は `parentId` が空ならスレッドを開始し、それ以外なら返信を追加します。`editThreadedComment`、`setThreadResolved`、`removeThreadedComment` でコメントを更新・削除できます。開始コメントを削除するとスレッド全体を削除します。コメントやメンションが参照している人物は `removePerson` で削除できません。

各スレッドは Excel の従来型ノートのスタブと同期します。行や列を挿入または削除すると、コメントのアンカーもセルと同じ規則で移動または削除されます。従来型ノートには `getComment`、`getComments`、`setComment` を使います。

C の呼び出しは `fm_sheet_threaded_comment_count`、`fm_sheet_threaded_comment_at`、`fm_sheet_add_threaded_comment`、`fm_sheet_edit_threaded_comment`、`fm_sheet_set_thread_resolved`、`fm_sheet_remove_threaded_comment`、`fm_workbook_person_count`、`fm_workbook_person_at`、`fm_workbook_add_person`、`fm_workbook_remove_person` です。WASM と Native Node は対応する camelCase、Python は snake_case のメソッドを使います。

## 画像のバイト列と描画アンカー

`probeImage(bytes)` は PNG、JPEG、GIF、BMP のバイト列を判定し、ワークブックを変更せずに `ImageFormat` とピクセル寸法を返します。`listDrawingObjects(sheet)` は画像、グラフ、図形、グループ、コネクタなど、描画に含まれるアンカー付きオブジェクトを列挙します。画像のメタデータにはオブジェクト ID、アンカー種別、`AnchorEditAs`、セル座標、EMUs 単位のオフセットと寸法、名前、説明、メディアパス、画像形式が含まれます。`getImage(sheet, objectId)` は画像バイト列のコピーを返します。

`insertImage` は 1 セルまたは 2 セルのアンカーを受け取ります。既存の絶対位置アンカーは `listDrawingObjects` で読み取れますが、この API から絶対位置アンカーを挿入することはできません。2 セル画像が編集に追随する方法は `AnchorEditAs` で指定します。幅または高さが 0 の場合は、判定したピクセル寸法を EMU に変換して使います。`removeImage` は他の描画オブジェクトを残して画像を削除します。メディアを参照するオブジェクトがなくなれば、未使用のメディアも削除されます。1 セルおよび 2 セルの画像アンカーは、行や列の挿入・削除に追随します。

`setImageAnchor` は、画像の ID、名前、クロップ、回転、反転、その他の要素を保ったまま既存画像を移動・サイズ変更します。1 セルまたは 2 セルの配置に対応し、幅または高さが 0 の場合は現在のサイズを保ちます。`setImageZOrder` は画像を描画オブジェクトのリスト内の位置へ移動します。`0` が背面、最後の位置が前面です。`snapshotImage` は、画像のリスト位置、要素、リレーションシップ、メディアを含む不透明なバージョン付きバイト列を取得します。`restoreImage` は同じ ID の画像を記録位置へ戻し、`{ newId: true }` を指定すると新しい ID のコピーを前面へ追加します。スナップショットは別のシートへ復元することもできます。解析済みの OOXML 描画が必要で、XLSB から保持された描画では `kIoDrawingUnparseable` になります。

C の呼び出しは `fm_workbook_probe_image`、`fm_sheet_drawing_object_count`、`fm_sheet_drawing_object_at`、`fm_sheet_get_image`、`fm_sheet_insert_image`、`fm_sheet_remove_image`、`fm_sheet_set_image_anchor`、`fm_sheet_set_image_z_order`、`fm_sheet_snapshot_image`、`fm_sheet_restore_image` です。レンダリング、ヒットテスト、グラフや図形の編集はこの API の対象外です。

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
  const snapshot = checked(wb.snapshotImage(0, inserted.objectId), 'snapshotImage')
  checked(wb.setImageAnchor(0, inserted.objectId, { row: 2, col: 0 }), 'setImageAnchor')
  checked(wb.setImageZOrder(0, inserted.objectId, 0), 'setImageZOrder')
  checked(wb.removeImage(0, inserted.objectId), 'removeImage')
  checked(wb.restoreImage(0, snapshot.bytes), 'restoreImage')
  checked(wb.removeImage(0, inserted.objectId), 'removeImage restored picture')
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
  const snapshot = checked(wb.snapshotImage(0, inserted.objectId), 'snapshotImage')
  checked(wb.setImageAnchor(0, inserted.objectId, { row: 2, col: 0 }), 'setImageAnchor')
  checked(wb.setImageZOrder(0, inserted.objectId, 0), 'setImageZOrder')
  checked(wb.removeImage(0, inserted.objectId), 'removeImage')
  checked(wb.restoreImage(0, snapshot.bytes), 'restoreImage')
  checked(wb.removeImage(0, inserted.objectId), 'removeImage restored picture')
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
        snapshot = wb.snapshot_image(0, object_id)
        wb.set_image_anchor(0, object_id, row=2, col=0)
        wb.set_image_z_order(0, object_id, 0)
        wb.remove_image(0, object_id)
        wb.restore_image(0, snapshot)
        wb.remove_image(0, object_id)
        print(len(wb.get_threaded_comments(0)), len(wb.get_persons()))
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

従来型ノート、スレッドコメント、OOXML の描画（読み込んだ画像と挿入画像を含む）は XLSB 保存時に省略します。`deferredFeatureCount` で省略を報告しますが、描画は画像ごとではなくシートの描画先ごとに 1 件と数えます。保持済みの互換性のある XLSB 描画パーツはそのまま出力する場合があります。詳しい制限は [ファイル形式](/ja/workbook/file-formats) を参照してください。従来型ノートの本文と再生成されるコメント VML のジオメトリは Excel に近似します。
