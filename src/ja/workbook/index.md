# ワークブックエンジン

このセクションでは、Formulon がワークブックをどうモデル化し、編集し、再計算し、保存するかを説明します。流れはどのホスト surface でも同じで、surface ごとに変わるのは packaging・メモリの所有権・エラー報告の仕方です。

```mermaid
flowchart LR
  A[bytes を開く] --> B[ワークブック model]
  B --> C[セル / 構造を編集]
  C --> D[依存関係グラフ]
  D --> E[再計算]
  E --> F[値を読む / bytes を保存]
```

::: info なぜ「Workbook」を独立セクションに分けるか
Runtimes ページは *どう* Formulon を呼ぶか、Workbook ページは呼び出されたあと *engine が何をするか* を説明します。両者を分けると、runtime ページはホスト統合に集中でき、engine の概念は一箇所にまとまります。
:::

## 次に読むもの

- [ライフサイクル](/ja/workbook/lifecycle) ─ bytes と model の往復
- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・関数挙動
- [ワークブック操作](/ja/workbook/operations) ─ sheet / cell / style / metadata
- [再計算](/ja/workbook/recalculation) ─ dirty セル・依存関係・iteration・partial recalc
- [動的配列](/ja/workbook/dynamic-arrays) ─ spill と shape 依存の再計算
- [ファイル形式](/ja/workbook/file-formats) ─ OOXML、XLSB、保持境界
