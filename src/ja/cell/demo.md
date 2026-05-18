---
title: フル UI デモ
description: ブラウザ上の Formulon を検証するための formulon-cell フルデモ。
---

# フル UI デモ

このページでは、同梱している `formulon-cell` プレイグラウンドをオーバーレイの
子ウィンドウで開きます。位置づけはあくまでデモ UI/UX です。Formulon の主役は
ヘッドレスな計算エンジンで、この UI はブラウザ版をスプレッドシート操作から
検証するために作られています。

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

プレイグラウンドはサンプルデータ入りのワークブックと `formulon-cell` の
フル UI で起動します。選択、数式編集、キーボード操作、コンテキストメニュー、
ダイアログ、テーマ切替を試せます。ヘッドレス利用では、この UI を必須経路と
見なさず、Formulon 本体の実行環境と API ページを参照してください。
