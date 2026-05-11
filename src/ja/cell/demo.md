---
title: フル UI デモ
description: ブラウザ上の Formulon を検証するための formulon-cell フルデモ。
---

# フル UI デモ

このページでは、同梱している `formulon-cell` playground を overlay 子ウィンドウ
で開きます。位置づけはあくまでデモ UI/UX です。Formulon の主役はヘッドレスな
計算エンジンで、この surface はブラウザ版を spreadsheet workflow から検証する
ために作られています。

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

playground は seed 済み workbook と `formulon-cell` のデフォルト full chrome
で起動します。選択、数式編集、キーボード操作、コンテキストメニュー、
ダイアログ、テーマ切替を試せます。ヘッドレス利用では、この UI を必須経路と
見なさず、Formulon 本体の実行環境と API ページを参照してください。
