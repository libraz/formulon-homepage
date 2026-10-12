# ワークブックエンジン

このセクションでは、Formulon がワークブックをどうモデル化し、編集し、再計算し、保存するかを説明します。各ホストからエンジンを呼ぶ方法は実行入口のページで扱い、ここでは呼び出したあとエンジンが何をするかを扱います。流れはどの実行入口でも同じです。違うのはパッケージの形、メモリの所有権、エラー報告の仕方です。

<DiagramFlow steps="バイト列を開く → ワークブックモデル → セル / 構造を編集 → 依存関係グラフ → 再計算 → 値を読む、またはバイト列を保存" />

## 次に読むもの

- [ライフサイクル](/ja/workbook/lifecycle) ─ バイト列とモデルの往復
- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・関数挙動
- [数式の言語](/ja/workbook/language) ─ 数式の入力・表示の言語と計算プロファイル
- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 書式 / メタデータ
- [表示とレイアウト](/ja/workbook/presentation) ─ 表示文字列、テーマ、実効書式、寸法、ページ分割
- [フィルターと入力規則](/ja/workbook/filters-validation) ─ 表示行の判定と入力候補の検証
- [条件付き書式](/ja/workbook/conditional-formats) ─ ルール、差分書式、描画のための評価
- [コメントと画像](/ja/workbook/comments-images) ─ スレッドでの会話と画像の配置
- [再計算](/ja/workbook/recalculation) ─ 再計算待ちセル・依存関係・反復計算・部分再計算
- [動的配列](/ja/workbook/dynamic-arrays) ─ スピルと形状に応じた再計算
- [ファイル形式](/ja/workbook/file-formats) ─ OOXML、XLSB、保持境界
- [ピボットテーブル](/ja/workbook/pivots) ─ キャッシュに基づく集計の作成と確認
