# ワークブックエンジン

このセクションでは、Formulon がワークブックをどうモデル化し、編集し、再計算し、保存するかを説明します。流れはどの実行入口でも同じで、実行入口ごとに変わるのはパッケージの形、メモリの所有権、エラー報告の仕方です。

<DiagramFlow steps="バイト列を開く → ワークブックモデル → セル / 構造を編集 → 依存関係グラフ → 再計算 → 値を読む、または bytes を保存" />

::: info なぜ「Workbook」を独立セクションに分けるか
実行入口のページは *どう* Formulon を呼ぶかを説明し、Workbook ページは呼び出されたあと *エンジンが何をするか* を説明します。両者を分けると、実行入口のページはホスト統合に集中でき、エンジンの概念は一箇所にまとまります。
:::

## 次に読むもの

- [ライフサイクル](/ja/workbook/lifecycle) ─ バイト列とモデルの往復
- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・関数挙動
- [ワークブック操作](/ja/workbook/operations) ─ sheet / cell / style / metadata
- [再計算](/ja/workbook/recalculation) ─ dirty セル・依存関係・iteration・partial recalc
- [動的配列](/ja/workbook/dynamic-arrays) ─ スピルと shape 依存の再計算
- [ファイル形式](/ja/workbook/file-formats) ─ OOXML、XLSB、保持境界
