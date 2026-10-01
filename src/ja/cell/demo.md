---
title: formulon-cell デモ
description: ブラウザで formulon-cell のスプレッドシート UI を確認します。
---

# formulon-cell デモ

このデモは formulon-cell を使い、サンプルデータ入りのワークブックを表示します。編集、範囲選択、メニューとダイアログ、テーマ切り替え、表示する UI 部品を試せます。

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

アプリケーションへ埋め込む場合は [埋め込み](/ja/cell/embedding) からプロファイルを選び、ホストに必要なオプションと拡張だけを追加してください。フレームワークとの連携は [React / Vue アダプター](/ja/cell/frameworks) を参照してください。

## 埋め込み設定を試す

UI プロファイルを切り替えると、同じワークブックを保ったまま周辺のコントロールが変わります。モーダルの例では、ホストのダイアログ内に書式設定や検索を開けます。

<CellEmbedDemo scenario="profiles" />

<CellEmbedDemo scenario="overlay" />
