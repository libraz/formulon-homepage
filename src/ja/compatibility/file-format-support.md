# ファイル形式サポート

## 概要

::: info 読み込み / 書き出し / 保持は別の概念です
読み込みは構造を解釈できること、書き出しは構造を出力できること、保持は往復保存で失わないことです。計算に影響するのは、評価対象として実装されている機能だけです。
:::

| 領域 | 状態 |
| --- | --- |
| `.xlsx` 読み込み | workbook、sheets、cells、styles、shared strings、relationships、tables、names、comments、hyperlinks、merges、validations、conditional formatting、pivot structures に対応 |
| `.xlsx` 書き出し | 上の読み込み行に挙げた構造 ─ workbook、sheets、cells、styles、shared strings、relationships、tables、names、comments、hyperlinks、merges、validations、conditional formatting、pivot structures ─ を、再計算済みワークブック出力の一部としてすべて書き戻す |
| `.xlsb` 読み込み / 書き出し | セル値、数式（シート間 3-D 参照、`LET` などの future function 名、動的配列の spill 数式を含む）、styles は往復保存の対象。conditional formatting、pivot table、comments、data validation は引き続き OOXML 限定。配列定数リテラルは数値要素のみに限定 |
| `.xlsm` のマクロバイト | 保持するが実行しない |
| 旧形式の `.xls` | 対象外 |
| chart / drawing の描画 | 対象外 |
| pivot cache の再計算 | 対象外。構造保持は対象 |

<DiagramLayers :layers="[
  { title: '形式別サポートの幅', nodes: [
    { label: '.xlsx', note: 'フル対応 ─ 読み込み・書き出し・往復保存' },
    { label: '.xlsb', note: '部分対応 ─ 値/数式/styles は可、CF/pivot/comments/validation は不可' },
    { label: '.xlsm', note: 'マクロバイトは通過のみ、実行しない' },
    { label: '.xls', note: '対象外' }
  ] }
]" />

Formulon は出力ファイル拡張子（CLI の `-o file.xlsb`、バインディングの `saveEx` / `save_ex`）からコンテナ形式を決め、読み込み時は内容をスニッフィングします。そのため `.xlsb` という拡張子で OOXML バイト列を持つファイル（またはその逆）も正しく扱えます。

## 最近の往復保存更新

v0.9.1 と v0.9.2 は共同で、ワークブックのリレーションシップ、共有数式参照の移動、印刷ページ分割メタデータの保持を強化しました。v0.9.1 でページ設定・余白・ヘッダー / フッター・印刷オプション・不透明なプリンター設定の往復保存を導入し、v0.9.2 は残っていたケースを解消し、Oracle 側のページ余白取得も追加しました。この往復保存経路は、現代的な `.xlsx` ワークフローの対応範囲に含まれ続けます。

v0.9.3 では、上の表にある `.xlsb` の主要なプロトコル上のギャップ ─ style records、`LET` などの future function を含む workbook-scope names、シート間 3-D 参照、動的配列の spill 数式 ─ を解消しました。これらの一部は、以前は実際の Excel が開けない `.xlsb` ファイルを生成していました。

v0.9.4 では、入力規則のドロップダウン表示状態（`show_dropdown`）が OOXML 往復保存の対象になりました。Excel はこれを反転した `showDropDown` 属性として保存するため、Formulon はホスト API 上では `show_dropdown` の意味で扱い、読み書き時にファイル形式側の意味へ合わせます。

## 保持ルール

Formulon が意味を解釈しないワークブック機能でも、可能な範囲でパッケージ構造は保持します。

## 計算ルール

再計算へ影響するのは、計算エンジンが表現している機能だけです。保持される構造が自動的に解釈されるわけではありません。
