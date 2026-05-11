# 非目標

意図的な境界です。engine を小さく検証しやすく保ち、対象外のワークブックに対しては曖昧さなく「対象外」と返せるようにします。

| 領域 | 理由 |
| --- | --- |
| VBA 実行 | セキュリティ。macro bytes は保存時に保持するが実行しない。 |
| 旧 `.xls`（BIFF） | 対象は modern Excel 365。`.xls` は OOXML 以前の世代に属する。 |
| chart / drawing の描画 | UI または document layer の責務であり、headless engine の責務ではない。 |
| PowerQuery / DAX | スプレッドシート数式とは別言語・別実行モデル。 |
| pivot cache の再計算 | 構造保持は対象、再計算は別の実行モデルが必要。 |
| ライブ external connections（OLE DB / Web / OData） | 本番実行を決定論的・オフラインに保つため。 |
| Spreadsheet UI | Formulon は headless。UI は上に乗せる（一例は [`formulon-cell`](/ja/cell/)）。 |

::: info 用語: headless engine
描画 surface もエンドユーザー UI も持たない計算 engine。ホストが呼び、人間は直接触らない。headless なら、サーバージョブ・ブラウザタブ・CLI・UI ライブラリのいずれでも同じ意味論で動かせます。
:::

## なぜ明示するのか

非目標を曖昧にしておくと、scope が滲んで互換性主張も曖昧になります。「やらないこと」を明示すれば:

- Issue triage が yes/no で答えられる
- 互換性主張は検証可能なまま
- 利用者は不足ツール（隣接 OSS）を把握できる

## 隣接ツール

- VBA / マクロ → Excel そのもの、またはホスト独自の自動化
- chart / drawing → Formulon で保持し、描画は別ライブラリ
- PowerQuery → 上流で実行し、`.xlsx` を Formulon に渡す
- UI → [`formulon-cell`](/ja/cell/)（beta、ブラウザ surface）

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ 対象内のこと
- [ファイル形式サポート](/ja/compatibility/file-format-support) ─ 保持と評価
