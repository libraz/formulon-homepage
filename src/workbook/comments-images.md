# Comments and images

The workbook model separates cell notes, threaded discussions, people, and drawing objects, which include pictures, charts, shapes, and table slicers. Sparkline groups are covered here too, because they live in the worksheet extension list beside the drawing. Charts are drawing objects too; the drawing methods below apply to them, and chart content is covered in [Charts](/workbook/charts). The APIs expose their stored metadata and media bytes; they do not render drawings.

## Threaded comments and people

`getThreadedComments(sheet)` returns a flat file-order list: each thread opener is followed by its replies. A `ThreadedComment` carries its id, zero-based anchor, person id, timestamp, text, parent id, resolved state, and UTF-16 mention spans. `getPersons()` reads the workbook person list. `addThreadedComment` opens a thread when `parentId` is empty and adds a reply otherwise; `editThreadedComment`, `setThreadResolved`, and `removeThreadedComment` update or remove comments. Removing an opener removes its whole thread. `removePerson` fails while a comment or mention still names that person.

Each thread keeps Excel's legacy note stub synchronized. Row and column insertions and deletions move or remove comment anchors with their cells. Classic notes remain available through `getComment`, `getComments`, and `setComment`; an empty `text` passed to `setComment` removes the note. `getComments(sheet)` includes notes anchored on otherwise-empty cells, and Python adds `comment_count(sheet)`. `getComment()` returns `null` both for a missing note and for an invalid sheet; on WASM and Native Node, `getCommentResult(sheet, row, col)` tells the two apart.

`getCommentVisible(sheet, row, col)` reports whether a note is shown without hovering (`value` 0 or 1), and `setCommentVisible(sheet, row, col, visible)` shows or hides it while keeping the note's box geometry. Both fail with `kNotFound` when no note is anchored at the cell. In Python, `get_comment_visible()` returns a bool, or `None` when no note exists there, and `set_comment_visible()` raises. A resave keeps each note's box (`x:Anchor`), its visibility, and the authors table of the comments part, including authors no remaining note names. Adding, removing, or showing a note regenerates the drawing without resetting the other notes' boxes or visibility, and a box follows its note through row and column edits. Each remaining note re-emits its own original `<v:shape>` (fill, stroke, shadow, text-box style, font, size) with only its anchor, visibility, and cell patched; a new note gets the default shape.

The C calls are `fm_sheet_threaded_comment_count`, `fm_sheet_threaded_comment_at`, `fm_sheet_add_threaded_comment`, `fm_sheet_edit_threaded_comment`, `fm_sheet_set_thread_resolved`, `fm_sheet_remove_threaded_comment`, `fm_workbook_person_count`, `fm_workbook_person_at`, `fm_workbook_add_person`, and `fm_workbook_remove_person`. WASM and Native Node use the matching camelCase methods; Python uses snake_case.

## Image bytes and drawing anchors {#drawing-anchors}

`probeImage(bytes)` recognizes PNG, JPEG, GIF, and BMP bytes and returns `ImageFormat` plus pixel dimensions without changing the workbook. `listDrawingObjects(sheet)` lists pictures, charts, shapes, groups, connectors, and other anchored objects. Picture metadata includes the object id, anchor kind, `AnchorEditAs`, cell coordinates, offsets and sizes in EMU (English Metric Units; 12,700 per point), name, description, media path, and image format. `getImage(sheet, objectId)` returns a copy of picture bytes.

`insertImage` accepts a one-cell or two-cell anchor. Existing absolute anchors can be read through `listDrawingObjects`, but this API cannot insert an absolute anchor. `AnchorEditAs` controls how a two-cell picture follows edits. A zero width or height uses the probed pixel size in EMU. `removeDrawing` removes a picture or chart while leaving other drawing objects; unused media is removed when no object references it. One-cell and two-cell picture anchors update with row and column insertions and deletions.

`setDrawingAnchor` moves or resizes an existing picture or chart while keeping its id, name, and other elements (for a picture, crop, rotation, and flips). It accepts one-cell or two-cell placements; a zero width or height keeps the current size. `setDrawingZOrder` moves the picture or chart to an object-list index, where `0` is the back and the last index is the top. `snapshotDrawing` captures an opaque, versioned byte string containing the object's list position, element, relationships, and media or chart parts. `restoreDrawing` replaces the object with the same id at its recorded position, or accepts `{ newId: true }` to add a copy on top with a fresh id. A snapshot can be restored into another sheet. Parsed OOXML drawings are required; retained XLSB drawings report `kIoDrawingUnparseable`.

The C calls are `fm_workbook_probe_image`, `fm_sheet_drawing_object_count`, `fm_sheet_drawing_object_at`, `fm_sheet_get_image`, `fm_sheet_insert_image`, `fm_sheet_remove_drawing`, `fm_sheet_set_drawing_anchor`, `fm_sheet_set_drawing_z_order`, `fm_sheet_snapshot_drawing`, and `fm_sheet_restore_drawing`. The renderer and hit testing remain outside this API.

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

## Drawing shapes

`listShapes(sheet)` lists the `xdr:sp` shapes and text boxes, `xdr:cxnSp` lines and connectors, and `xdr:grpSp` groups of a sheet's drawing in z-order, back first; the children of a group are not listed. A `Shape` carries `objectId`, `kind` (`DrawingObjectKind`), the anchor fields read as in `listDrawingObjects`, `name`, `prst` (the preset geometry, empty for custom geometry or a group), `text` (paragraphs joined with `\n`), `textBox`, `fillKind` and `lineKind` (`ShapePaint`), `fillRgb` and `lineRgb` (0xRRGGBB when the kind is `Solid`), `lineWidthEmu` (0 without a width), `rotation` in 60000ths of a degree, and `hidden`.

`insertShape(sheet, spec)` appends a shape on top and returns its id; a sheet without a drawing gets one, and existing drawing content is kept. `updateShape(sheet, objectId, spec)` applies only the fields `spec` names and keeps the rest of the shape's XML. `removeShape(sheet, objectId)` removes a shape, connector, or group with its children. A key left out of the spec, or `null`, is not applied. An insert needs `anchorKind` and defaults `prst` to `rect` and `name` to `Shape <id>`; a `prst` that names a line or connector geometry makes a connector, which holds no text. Giving `anchorKind` applies the whole anchor (`editAs`, `from*`, `to*`, `cx`, `cy`), and an update cannot change the anchor kind. `fillKind` and `lineKind` must be `Solid` or `None` on input. Shapes the record cannot express are listed with `ShapePaint.Other` or empty fields and pass through a save unchanged. Shapes follow row and column edits as pictures do.

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

Python takes the same fields as keyword arguments to `insert_shape()` and `update_shape()` (`anchor_kind`, `from_row`, `fill_kind`, and so on) and returns `list_shapes()` as a list of `Shape`. The C calls are `fm_sheet_shape_count`, `fm_sheet_shape_at`, `fm_sheet_insert_shape`, `fm_sheet_update_shape`, and `fm_sheet_remove_shape`, with the `fm_shape` record.

## Table slicers

`listSlicers(sheet)` lists the table slicers a sheet hosts, each with its `name`, `caption`, slicer cache (`cacheName`), `tableName` and `columnName`, `style`, `columnCount`, `rowHeight` (EMU), `sortOrder` (`SlicerSortOrder`), `crossFilter` (`SlicerCrossFilter`), anchor, and `objectId`, the id of its frame in the sheet's drawing. A slicer is addressed by its position in that list, and adding or removing one shifts later indices. The selection itself lives in the table's AutoFilter, not in the slicer. Slicers over a pivot cache pass through a save untouched and are not listed.

`addSlicer(sheet, table, column, spec)` creates a slicer over a 0-based column of a workbook-wide table index (see `tableAt`); the table may live on another sheet. It writes the slicer and cache parts, relationships, content types, the `Slicer_*` defined name, and the drawing frame. The spec needs an anchor (`fromRow` applies the whole two-cell anchor) and defaults `name` and `caption` to the column name, `rowHeight` to 241300 EMU, and `columnCount` to 1. `updateSlicer(sheet, index, spec)` changes the caption, style (an empty string removes it), item columns, row height, sort order, cross filter, and anchor; the name cannot be updated. `removeSlicer(sheet, index)` removes the slicer with its frame, removes its cache once no slicer uses it, and drops the sheet's drawing when the slicer was its last object. Removing a table or a sheet, or deleting the rows or columns under a slicer's frame, removes the slicers bound to it the same way. A loaded slicer survives a resave with all its parts, and its frame moves with row and column edits.

Table slicers loaded from an `.xlsx` source are not written to `.xlsb` and are counted in `deferredFeatureCount`. Python uses `list_slicers()`, `add_slicer()` (with an `anchor` argument), `update_slicer()`, and `remove_slicer()`. The C calls are `fm_sheet_slicer_count`, `fm_sheet_slicer_at`, `fm_sheet_add_slicer`, `fm_sheet_update_slicer`, and `fm_sheet_remove_slicer`, with `fm_slicer`.

## Sparkline groups

`listSparklineGroups(sheet)` lists the `x14:sparklineGroups` of a sheet's worksheet extension list in document order. A `SparklineGroup` carries its `type` (`SparklineType`: `Line`, `Column`, `Stacked`), the series, negative, axis, marker, first, last, high, and low colours, the matching `markers`, `high`, `low`, `first`, `last`, and `negative` toggles, `displayXAxis`, `displayHidden`, the axis scaling (`minAxisType`, `maxAxisType`, `manualMin`, `manualMax`), the date axis (`dateAxis`, `dateAxisRef`), `lineWeight`, `emptyCellsAs`, and its `sparklines`. Each `Sparkline` is a data `formula` (a sheet-qualified range without `=`) and the single A1 `location` cell that shows it. A colour whose `kind` is 0 is absent, and `manualMin` / `manualMax` are `null` when the bound is not set.

`addSparklineGroup(sheet, spec)` appends a group; `spec.sparklines` must hold at least one sparkline, and any other field left out takes the default of a new line group. `updateSparklineGroup(sheet, index, spec)` rewrites the modelled attributes, colours, and date range, and keeps the group's sparklines and its unmodelled attributes and children (`rightToLeft`, `uid`, unknown extensions). `setSparklineGroupSparklines(sheet, index, sparklines)` replaces the sparklines of a group, and `removeSparklineGroup(sheet, index)` removes a group. Groups are addressed by position, and adding or removing one shifts later indices. Python uses `list_sparkline_groups()`, `add_sparkline_group()`, `update_sparkline_group()`, `set_sparkline_group_sparklines()`, and `remove_sparkline_group()`; the C calls are `fm_sheet_sparkline_group_count`, `fm_sheet_sparkline_group_at`, `fm_sheet_sparkline_at`, `fm_sheet_add_sparkline_group`, `fm_sheet_update_sparkline_group`, `fm_sheet_set_sparkline_group_sparklines`, and `fm_sheet_remove_sparkline_group`. Sparkline groups are written to `.xlsb`, except groups whose references cannot be encoded, which `deferredFeatureCount` counts.
