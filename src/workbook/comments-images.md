# Comments and images

The workbook model separates cell notes, threaded discussions, people, and drawing objects. Charts are drawing objects too; the drawing methods below apply to them, and chart content is covered in [Charts](/workbook/charts). The APIs expose their stored metadata and media bytes; they do not render drawings.

## Threaded comments and people

`getThreadedComments(sheet)` returns a flat file-order list: each thread opener is followed by its replies. A `ThreadedComment` carries its id, zero-based anchor, person id, timestamp, text, parent id, resolved state, and UTF-16 mention spans. `getPersons()` reads the workbook person list. `addThreadedComment` opens a thread when `parentId` is empty and adds a reply otherwise; `editThreadedComment`, `setThreadResolved`, and `removeThreadedComment` update or remove comments. Removing an opener removes its whole thread. `removePerson` fails while a comment or mention still names that person.

Each thread keeps Excel's legacy note stub synchronized. Row and column insertions and deletions move or remove comment anchors with their cells. Classic notes remain available through `getComment`, `getComments`, and `setComment`; an empty `text` passed to `setComment` removes the note. `getComments(sheet)` includes notes anchored on otherwise-empty cells, and Python adds `comment_count(sheet)`. `getComment()` returns `null` both for a missing note and for an invalid sheet; on WASM and Native Node, `getCommentResult(sheet, row, col)` tells the two apart.

The C calls are `fm_sheet_threaded_comment_count`, `fm_sheet_threaded_comment_at`, `fm_sheet_add_threaded_comment`, `fm_sheet_edit_threaded_comment`, `fm_sheet_set_thread_resolved`, `fm_sheet_remove_threaded_comment`, `fm_workbook_person_count`, `fm_workbook_person_at`, `fm_workbook_add_person`, and `fm_workbook_remove_person`. WASM and Native Node use the matching camelCase methods; Python uses snake_case.

## Image bytes and drawing anchors {#drawing-anchors}

`probeImage(bytes)` recognizes PNG, JPEG, GIF, and BMP bytes and returns `ImageFormat` plus pixel dimensions without changing the workbook. `listDrawingObjects(sheet)` lists pictures, charts, shapes, groups, connectors, and other anchored objects. Picture metadata includes the object id, anchor kind, `AnchorEditAs`, cell coordinates, offsets and sizes in EMU (English Metric Units; 12,700 per point), name, description, media path, and image format. `getImage(sheet, objectId)` returns a copy of picture bytes.

`insertImage` accepts a one-cell or two-cell anchor. Existing absolute anchors can be read through `listDrawingObjects`, but this API cannot insert an absolute anchor. `AnchorEditAs` controls how a two-cell picture follows edits. A zero width or height uses the probed pixel size in EMU. `removeDrawing` removes a picture or chart while leaving other drawing objects; unused media is removed when no object references it. One-cell and two-cell picture anchors update with row and column insertions and deletions.

`setDrawingAnchor` moves or resizes an existing picture or chart while keeping its id, name, and other elements (for a picture, crop, rotation, and flips). It accepts one-cell or two-cell placements; a zero width or height keeps the current size. `setDrawingZOrder` moves the picture or chart to an object-list index, where `0` is the back and the last index is the top. `snapshotDrawing` captures an opaque, versioned byte string containing the object's list position, element, relationships, and media or chart parts. `restoreDrawing` replaces the object with the same id at its recorded position, or accepts `{ newId: true }` to add a copy on top with a fresh id. A snapshot can be restored into another sheet. Parsed OOXML drawings are required; retained XLSB drawings report `kIoDrawingUnparseable`.

The C calls are `fm_workbook_probe_image`, `fm_sheet_drawing_object_count`, `fm_sheet_drawing_object_at`, `fm_sheet_get_image`, `fm_sheet_insert_image`, `fm_sheet_remove_drawing`, `fm_sheet_set_drawing_anchor`, `fm_sheet_set_drawing_z_order`, `fm_sheet_snapshot_drawing`, and `fm_sheet_restore_drawing`. The renderer, hit testing, and shape editing remain outside this API.

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

Classic notes, threaded comments, and OOXML drawings, including loaded and inserted pictures, are omitted on XLSB save. `deferredFeatureCount` reports these omissions; drawings count once per sheet drawing target, not once per picture. Compatible retained XLSB drawing parts may pass through. See [File formats](/workbook/file-formats) for the full boundary. Legacy note text and regenerated comment VML geometry approximate Excel.
