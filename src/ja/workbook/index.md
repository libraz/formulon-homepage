# ワークブックエンジン

このセクションでは、Formulon がワークブックをどうモデル化し、編集し、再計算し、保存するかを説明します。流れはどの実行環境でも同じで、環境ごとに変わるのはパッケージの形、メモリの所有権、エラー報告の仕方です。

```mermaid
flowchart LR
  A[バイト列を開く] --> B[ワークブックモデル]
  B --> C[セル / 構造を編集]
  C --> D[依存関係グラフ]
  D --> E[再計算]
  E --> F[値を読む / bytes を保存]
```

::: info なぜ「Workbook」を独立セクションに分けるか
実行環境のページは *どう* Formulon を呼ぶか、Workbook ページは呼び出されたあと *エンジンが何をするか* を説明します。両者を分けると、実行環境のページはホスト統合に集中でき、エンジンの概念は一箇所にまとまります。
:::

## 次に読むもの

- [ライフサイクル](/ja/workbook/lifecycle) ─ バイト列とモデルの往復
- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・関数挙動
- [ワークブック操作](/ja/workbook/operations) ─ sheet / cell / style / metadata
- [再計算](/ja/workbook/recalculation) ─ dirty セル・依存関係・iteration・partial recalc
- [動的配列](/ja/workbook/dynamic-arrays) ─ spill と shape 依存の再計算
- [ファイル形式](/ja/workbook/file-formats) ─ OOXML、XLSB、保持境界
