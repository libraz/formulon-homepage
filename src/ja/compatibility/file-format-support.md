# ファイル形式サポート

## 概要

::: info 読み込み / 書き出し / 保持は別の主張です
読み込みは parse できること、書き出しは emit できること、保持は round-trip で失わないことです。計算に影響するのは、評価対象として実装されている機能だけです。
:::

| 領域 | 状態 |
| --- | --- |
| `.xlsx` 読み込み | workbook、sheets、cells、styles、shared strings、relationships、tables、names、comments、hyperlinks、merges、validations、conditional formatting、pivot structures |
| `.xlsx` 書き出し | 再計算済みワークブック出力と対応構造 |
| `.xlsb` 読み込み / 書き出し | modern binary workbook workflow 用に実装済み |
| `.xlsm` のマクロバイト | 保持するが実行しない |
| 旧形式の `.xls` | 対象外 |
| chart / drawing の描画 | 対象外 |
| pivot cache の再計算 | 対象外。構造保持は対象 |

## 保持ルール

Formulon が意味論を持たないワークブック機能でも、可能な範囲でパッケージ構造は保持します。

## 計算ルール

再計算へ影響するのは、計算エンジンが表現している機能だけです。保持される構造が自動的に解釈されるわけではありません。
