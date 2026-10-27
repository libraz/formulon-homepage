# ワークブックエンジン

このセクションでは、Formulon がワークブックをどうモデル化し、編集し、再計算し、保存するかを説明します。各ホストからエンジンを呼ぶ方法は実行入口のページで扱い、ここでは呼び出したあとエンジンが何をするかを扱います。流れはどの実行入口でも同じです。違うのはパッケージの形、メモリの所有権、エラー報告の仕方です。

<DiagramFlow :steps="[
  { label: 'バイト列を開く', note: 'XLSX または XLSB' },
  { label: 'ワークブックモデル', note: 'シート・セル・スタイル・名前' },
  { label: '編集', note: 'セルまたは構造' },
  { label: '依存関係グラフ', note: 'セル間の参照関係' },
  { label: '再計算', note: '再計算待ちのセルを評価' },
  { label: '読む / 保存', note: 'キャッシュ値、またはバイト列' }
]" label="ワークブックの流れ: バイト列を開き、モデルを作り、編集し、依存関係グラフを更新して再計算し、値を読むかバイト列を保存する" caption="どのホストでも流れは同じで、違うのはパッケージ、メモリの所有、エラーの報告方法だけです。" />

## 次に読むもの

数式とキャッシュ値の違いを初めて学ぶ場合は、[基本概念](/ja/start/concepts) から進めてください。続いて、ライフサイクルと計算の流れを確認してから、個別の機能を読みます。

- [ライフサイクル](/ja/workbook/lifecycle) ─ バイト列とモデルの往復
- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・関数挙動
- [数式の言語](/ja/workbook/language) ─ 数式の入力・表示の言語と計算プロファイル
- [再計算](/ja/workbook/recalculation) ─ 再計算待ちセル・依存関係・反復計算・部分再計算
- [動的配列](/ja/workbook/dynamic-arrays) ─ スピルと形状に応じた再計算
- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 書式 / メタデータ
- [表示とレイアウト](/ja/workbook/presentation) ─ 表示文字列、テーマ、実効書式、寸法、ページ分割
- [フィルターと入力規則](/ja/workbook/filters-validation) ─ 表示行の判定と入力候補の検証
- [条件付き書式](/ja/workbook/conditional-formats) ─ ルール、差分書式、描画のための評価
- [コメントと画像](/ja/workbook/comments-images) ─ スレッドでの会話と画像の配置
- [グラフ](/ja/workbook/charts) ─ グラフの読み取り・作成・編集と、セル値に対する系列の解決
- [ファイル形式](/ja/workbook/file-formats) ─ OOXML、XLSB、保持境界
- [ピボットテーブル](/ja/workbook/pivots) ─ キャッシュに基づく集計の作成と確認
