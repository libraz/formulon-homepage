---
title: テキスト照合
description: 測定済みの Mac 規則、Windows の単語順規則、関数ごとの強度で、文字列の比較、並べ替え、グループ化、検索を確認します。
---

# テキスト照合

スプレッドシートの文字列比較は、互換性を左右する仕様です。同じ 2 つの文字列でも、比較演算子では等しく、完全一致検索では別物で、`UNIQUE()` では 1 行にまとまることがあります。まずプロファイルを選び、そのうえで再現したい Excel の操作に合う強度を選んでください。

::: info 用語: 照合と強度
照合（collation）は、どの文字列を等しいとみなし、どの順序で並べるかを決める規則です。強度（strength）は、同じプロファイルの中で関数がどの段階までその規則を見るかを表します。
:::

## まず作業を決める

| ワークブックが行うこと | 照合強度 | 関数と対象 |
| --- | --- | --- |
| 値を比較する、またはテキスト条件を適用する | `compare` | `=`, `<>`, `<`, `>`, `<=`, `>=`、条件関数、`SWITCH`、近似一致の `MATCH` / `VLOOKUP`、`SEARCH` / `SEARCHB`、条件付き書式のテキストルール、AutoFilter とピボットテーブルのラベルフィルター |
| 並べ替え、グループ化、重複排除、現代的な検索を行う | `dynamic` | `SORT`、`UNIQUE`、`GROUPBY`、`XLOOKUP`、`XMATCH`、ピボットのグループ化 |
| 従来型の完全一致検索を再現する | `classic exact` | 完全一致の `MATCH`、`VLOOKUP`、`HLOOKUP` |

Mac プロファイルの `compare` は測定済みの展開と、比較専用の第 3 段階を含みます。`dynamic` は比較専用の第 3 段階を無視するため、動的配列の操作では幅の異なる文字を Excel と同じようにグループ化できます。Mac の `classic exact` は展開と半角濁点かなの合成を抑えます。そのため「Excel の文字列等価性」だけでは、統合テストの条件として不十分です。

## Mac と Windows は異なるモデルを使います

すべての `mac-*` プロファイルは、Mac Excel の測定表から生成した順序保存キーを使います。キーには主、第 2、動的、比較専用の第 3 段階の重みと、単語ソート記号や末尾の無視可能な記号に関する測定規則が含まれます。各ロケールに専用の表と数式 Oracle があり、単一の Unicode 照合器をそのまま使っているわけではありません。

Windows プロファイルは、同じロケール表から、Windows Excel 365 ja-JP で実測したホスト規則（Windows の単語順）でキーを作ります。ハイフンとアポストロフィは、ほかの差がすべて同じ場合にだけ順序に影響し、`æ` は `ae` と等しく、半角かなは全角かなより前、カタカナはひらがなより前に並びます。タイ語の前置母音は位置を保ち、子音より前に並びます。幅の違いは比較強度でだけ区別され、かなの種類は動的強度でも区別されます。漢字の順序はロケールごとの規則に従います。照合順序は、すべての Windows プロファイルで実測済みとは報告されません。`win-365-ja_JP` も例外ではありませんが、区切り文字などのロケール情報は実測済みです。`localeFacts(profileId).facts.collationMeasured` は Mac で true、Windows で false となり、この区別を表します。

この違いは小さな再現例で確認できます。実測済み Mac 日本語プロファイルでは `"æ"="ae"` は `FALSE` ですが、Windows 日本語プロファイルでは `TRUE` です。ハイフン、かな、非ラテン文字でも差が出ます。テストでは実行したマシンに依存せず、プロファイルを固定してください。

## 測定された区別

次の例は照合 fixture と単体テストから取り出したものです。示したプロファイルと強度に対する結果であり、すべてのロケールに適用する等価関係ではありません。

### 文字幅とかな

- 測定済み Mac の `ja_JP`、`en_US`、`ko_KR`、`th_TH` では、動的操作で `ｶﾞ` と `ガ`、`Ａ` と `A`、`ア` と `あ` が同じグループになります。Mac の `zh_CN` と `zh_TW` では動的操作でも `ア` と `あ` を区別しますが、動的強度では `Ａ` と `A`、`ｶﾞ` と `ガ` を同じグループにします。
- `zh_CN` と `zh_TW` の比較強度では `A` と `Ａ`、`ｶﾞ` と `ガ` を区別します。動的強度では幅の違いを折りたたみます。
- Windows プロファイルでは、`ｶﾞ` / `ガ`、`ｱ` / `ア`、`Ａ` / `A` を比較強度では区別し、動的強度ではそれぞれ同じグループにまとめ、完全一致では区別します。`ア` と `あ` は動的強度でも区別され、カタカナが先に並びます。

### アクセントと展開

- Mac と Windows のプロファイルは、比較の前に基本文字と後続の結合文字（U+0300〜U+036F）を合成します。そのため `"a"&UNICHAR(769)` は比較、並べ替え、動的な検索で `á` と等しくなります。完全一致検索では区別されます。
- 測定済み Mac の英語表では、比較で `straße` と `strasse` が等しくなり、`straße` は `strasze` より先になります。完全一致検索では `ß` と `ss` を区別します。
- フランス語で測定された順序は `cote < coté < côte < côté` です。
- ドイツ語では `ä < ae` と `äz > aea` がテストされています。
- スペイン語のテストでは `ñ` が `nz` より後になり、英語表では `ñ` が `nz` より前になります。

### かな記号、タイ語、ハングル

- Mac 日本語では `かー` と `かあ` が比較で等しく、`かゝ` と `かか` も等しくなります。一方 `がゝ` は `がか` より後です。末尾の長音記号が隣の文字と常に交換可能になるわけではありません。
- 測定されたタイ語の順序はプロファイルごとに異なります。`mac-365-ja_JP` では `กา` が `เก` より前になり、`mac-365-zh_CN` と Windows プロファイルでは `เก` が `กา` より前になります。これはラテン文字のアルファベット順ではなく、前置母音の規則です。
- Mac の `ja_JP`、`en_US`、`ko_KR`、`th_TH` では、比較でハングルを分解します。`각` は `가` と U+11A8 の組と等しく、`간` は `가나` より後です。`zh_CN` の表では `각` と分解列を区別します。`ko_KR` には独自の KS X 1001 読み順もあります。

### 漢字と句読点の順序

漢字の順序はプロファイルデータです。測定済み Mac の表は、`ja_JP` に JIS X 0208 のコードページ順、`zh_CN` に GB2312 のコードページ順（ピンインを基礎とする中国語表）、`ko_KR` に KS X 1001 の読み順、`zh_TW` に画数グループとグループ内のコードポイント順を使います。それ以外のロケールは基礎となる測定表を使います。中国語の単語ソートでは、ソーステストが `ab < a'b < a-b` を確認しており、`a'` と `a` は等しくありません。

これらの規則を `Intl.Collator` の既定値や単一の Unicode 正規化で置き換えないでください。独自検索には役立つ場合がありますが、名前付き Excel プロファイルや Formulon が関数ごとに使う強度は再現できません。

## 数式の外で文字列を比較する

ホストの UI でエンジンと同じ比較が必要な場合は、`compareText(a, b, strength, profileId)` を使います。戻り値は `{ status, order }` で、`order` は -1、0、1 のいずれかです。`collationClasses(values, strength, profileId)` は型付きの値を分類し、`{ status, classIds, classCount }` を返します。クラス ID は `SORT` の昇順で 0 から始まります。順序は数値、文字列、真偽値、コード順のエラー、空白です。数値とその文字列表現は別のクラスになります。ID は 1 回の呼び出しの中でだけ有効なので、呼び出しをまたぐ場合は ID ではなく型付きの値を保持してください。

::: code-group

```ts [WASM / Native Node]
import { CollationStrength } from '@libraz/formulon' // native: @libraz/formulon-native

// wb is an initialized Workbook.
const result = wb.compareText('straße', 'strasse', CollationStrength.Compare, 'mac-365-en_US')
if (!result.status.ok) throw new Error(result.status.message)
console.log(result.order) // 0
```

```python [Python]
from formulon import CollationStrength, Workbook

print(Workbook.compare_text("straße", "strasse", CollationStrength.COMPARE, "mac-365-en_US"))  # 0
```

:::

Python の `collation_classes(values, strength, profile_id)` は `class_ids` と `class_count` を持つ `CollationClasses` レコードを返し、ホスト側の失敗では `FormulonError` を送出します。C の対応する関数は `fm_text_compare` と `fm_collation_classes` です。CLI には独立した比較コマンドはありません。

## 3 つのバインディングで同じ式を比較する

次の例は同じワークブック API を使い、実測済みの `mac-365-ja_JP` 照合と Windows の単語順による `win-365-ja_JP` 照合を比較します。`SORT` を動的強度で実行し、スピルした 2 セルを表示します。出力は現在の WASM と Native の成果物で確認しており、Python バインディングも同じ C ABI を呼び出します。

::: code-group

```ts [WASM]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
try {
  for (const profile of ['mac-365-ja_JP', 'win-365-ja_JP'] as const) {
    const status = wb.setExcelProfileId(profile)
    if (!status.ok) throw new Error(status.message)
    if (!wb.setFormula(0, 0, 0, '=SORT({"coop";"co-op"})').ok) throw new Error('setFormula failed')
    if (!wb.recalc().ok) throw new Error('recalc failed')
    console.log(profile, [0, 1].map(row => wb.getDisplayText(0, row, 0).text))
  }
} finally {
  wb.delete()
}
```

```ts [Native Node]
import { Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
for (const profile of ['mac-365-ja_JP', 'win-365-ja_JP'] as const) {
  const status = wb.setExcelProfileId(profile)
  if (!status.ok) throw new Error(status.message)
  if (!wb.setFormula(0, 0, 0, '=SORT({"coop";"co-op"})').ok) throw new Error('setFormula failed')
  if (!wb.recalc().ok) throw new Error('recalc failed')
  console.log(profile, [0, 1].map(row => wb.getDisplayText(0, row, 0).text))
}
wb.dispose()
```

```python [Python]
from formulon import Workbook

with Workbook.create_default() as wb:
    for profile in ("mac-365-ja_JP", "win-365-ja_JP"):
        wb.set_excel_profile_id(profile)
        wb.set_formula(0, 0, 0, '=SORT({"coop";"co-op"})')
        wb.recalc()
        print(profile, [wb.get_display_text(0, row, 0)[0] for row in (0, 1)])
```

:::

3 つとも次の内容に相当する出力になります。

```text
mac-365-ja_JP [ 'co-op', 'coop' ]
win-365-ja_JP [ 'coop', 'co-op' ]
```

これは動的配列操作の比較です。`="co-op"="coop"`、完全一致の `MATCH`、`UNIQUE` が同じ強度だという意味ではありません。ワークブックで使う関数ごとにテストしてください。

## プロファイルと強度を組み合わせてテストする

回帰テスト用のデータには、プロファイル ID、関数、入力文字列、期待結果を記録してください。小さな組み合わせでも、次を含めておくと役立ちます。

- `ß` / `ss`、`Ａ` / `A`、`ｶﾞ` / `ガ`、`ア` / `あ` を使う `SORT` と `UNIQUE`
- 同じ組を使う比較演算と完全一致 `MATCH`
- 動的検索の組を使う `XLOOKUP` または `XMATCH`
- 日本語、中国語簡体字、中国語繁体字、韓国語のラベルを並べ替える場合は、ロケール固有の漢字の組
- そのデータがタイ語またはハングルのラベルなら、タイ語またはハングルの組

結果が変わったら、最初にプロファイル ID と関数の強度を確認してください。そのうえで、同じプロファイルで取得した検証データと比較します。照合の実装とテストは、Formulon ソースツリーの `src/eval/collation.h`、`src/eval/collation.cpp`、`tests/unit/eval/collation_test.cpp`、`tests/unit/eval/sort_eval_test.cpp` にあります。

## 次に読むもの

- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ 区切り文字、コードページ、通貨、測定状況
- [ワークブックの言語](/ja/workbook/language) ─ 数式テキストのローカライズ
- [セルの言語切り替え](/ja/cell/language-switching) ─ エディター言語の変更
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 測定表と数式ゴールデンの検証方法
