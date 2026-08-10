# ファイル形式サポート

## 概要

::: info 読み込み / 書き出し / 保持は別の概念です
読み込みは構造を解釈できること、書き出しは構造を出力できること、保持は往復保存で失わないことです。計算に影響するのは、評価対象として実装されている機能だけです。
:::

| 領域 | 状態 |
| --- | --- |
| `.xlsx` 読み込み | workbook、sheets、cells、styles、shared strings、relationships、tables、names、comments、hyperlinks、merges、validations、conditional formatting、pivot structures に対応 |
| `.xlsx` 書き出し | 上の読み込み行に挙げた構造 ─ workbook、sheets、cells、styles、shared strings、relationships、tables、names、comments、hyperlinks、merges、validations、conditional formatting、pivot structures ─ を、再計算済みワークブック出力の一部としてすべて書き戻す |
| `.xlsb` 読み込み / 書き出し | styles、行 / 列レイアウト、結合、`date1904`、view / zoom / frozen panes、動的配列メタデータ、対応する tokenized formula をモデル化して出力。既存 worksheet tail はそのまま保持 |
| `.xlsm` のマクロバイト | 保持するが実行しない |
| 旧形式の `.xls` | 対象外 |
| chart / drawing の描画 | 対象外 |
| pivot cache の再計算 | 対象外。構造保持は対象 |

<DiagramLayers :layers="[
  { title: '形式別サポートの幅', nodes: [
    { label: '.xlsx', note: 'フル対応 ─ 読み込み・書き出し・往復保存' },
    { label: '.xlsb', note: 'モデル化したコアと worksheet tail の保持' },
    { label: '.xlsm', note: 'マクロバイトは通過のみ、実行しない' },
    { label: '.xls', note: '対象外' }
  ] }
]" />

Formulon は出力ファイル拡張子（CLI の `-o file.xlsb`、バインディングの `saveEx` / `save_ex`）からコンテナ形式を決め、読み込み時は内容をスニッフィングします。そのため `.xlsb` という拡張子で OOXML バイト列を持つファイル（またはその逆）も正しく扱えます。

## 保持ルール

Formulon が意味を解釈しないワークブック機能でも、可能な範囲でパッケージ構造は保持します。これにより、作成・描画・レビューを別ツールが担ったまま、Formulon が値だけを更新できます。

## 計算ルール

再計算へ影響するのは、計算エンジンが表現している機能だけです。保持される構造が自動的に解釈されるわけではありません。
