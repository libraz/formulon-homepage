---
title: 数式の言語
description: ローカライズされた数式を保存用の英語表記へ変換し、ロケール情報と計算プロファイルを使い分けます。
---

# 数式の言語

表計算アプリでは、画面のラベル、利用者が読む・入力する数式、計算に使うプロファイルを連携させます。Formulon のエンジンは数式の変換と計算プロファイルを扱います。[formulon-cell](/ja/cell/language-switching) は UI の翻訳も提供し、画面の言語とワークブックの設定を連動させます。

エンジンは英語の関数名、小数点、保存用の区切り文字で数式を保持します。入力時と表示時に変換し、ファイルやアプリの状態には保存用の表記を使います。

<DiagramFlow :steps="[
  { label: '各言語での入力', note: '=SUMME(1;2,5)' },
  { label: 'canonicalizeFormula', note: 'プロファイル: mac-365-de_DE' },
  { label: '保存用の数式', note: '=SUM(1,2.5)' },
  { label: 'localizeFormula', note: '選んだ言語で表示' }
]" />

## 数式全体を変換する

両方向の変換にプロファイル ID を指定します。これらの呼び出しは文字列を変換し、ワークブックの計算プロファイルは変更しません。

::: code-group

```ts [WASM / Native Node]
// wb は初期化済みの Workbook です。各ランタイムの導入例を参照してください。
const profile = 'mac-365-de_DE' as const
const displayed = wb.localizeFormula('=SUM(1,2.5)', profile)
if (!displayed.status.ok) throw new Error(displayed.status.message)
console.log(displayed.value) // =SUMME(1;2,5)

const stored = wb.canonicalizeFormula(displayed.value, profile)
if (!stored.status.ok) throw new Error(stored.status.message)
const status = wb.setFormula(0, 0, 0, stored.value)
if (!status.ok) throw new Error(status.message)
const recalculated = wb.recalc()
if (!recalculated.ok) throw new Error(recalculated.message)
```

```python [Python]
# wb はシートを持つ初期化済みの Workbook です。
profile = "mac-365-de_DE"
displayed = wb.localize_formula("=SUM(1,2.5)", profile)
print(displayed)  # =SUMME(1;2,5)
stored = wb.canonicalize_formula(displayed, profile)
wb.set_formula(0, 0, 0, stored)
wb.recalc()
```

:::

CLI は保存用の英語表記で数式を受け取ります。数式全体の翻訳コマンドはなく、`--profile` は計算の挙動を選びます。C ABI には `fm_formula_localize` と `fm_formula_canonicalize` があります。[C リファレンス](/ja/api/c)を参照してください。

変換の対象は、関数名、小数点、引数と配列の区切り文字、真偽値リテラル、エラー名です。引用符内の文字列、引用符付きシート名、外部ワークブックの修飾子、構造化参照の角括弧内はそのまま残ります。変換は文字列の書き換えであり、数式の構文を検証しません。数式の登録時に構文を検証し、不正な入力はワークブックを変更せずに拒否します。[エラーモデル](/ja/compatibility/errors)を参照してください。

## 関数名を変換する

関数選択 UI には `localizeFunctionName(canonicalName, profileId)` と `canonicalizeFunctionName(localizedName, profileId)` を使います。Python では `localize_function_name` と `canonicalize_function_name` です。未知のプロファイルや関数を指定すると、JavaScript では失敗の Status、Python では `FormulonError` が返ります。

ドイツ語、フランス語、スペイン語（スペイン・メキシコ）、ブラジルのポルトガル語、ロシア語、イタリア語、オランダ語のプロファイルには、その言語の関数名があります。日本語で名前が変わるのは `DBCS`、`DOLLAR`、`USDOLLAR` だけで、繁体字中国語では `DBCS` だけです。簡体字中国語、韓国語、タイ語、米国英語では英語の関数名のままです。関数名が同じでも、区切り文字、通貨、文字列の比較方法が同じとは限りません。

`functionMetadata(name)` は保存用の関数名に対する引数の数や実装状況を返します。結果はロケールに依存せず、翻訳済みの説明や引数ヘルプは含みません。UI に必要な場合はホスト側のカタログから提供します。

## 区切り文字と表示規則を調べる

ブラウザのロケールから推測せず、`localeFacts(profileId)` を使います。JavaScript の戻り値は `status` と、失敗時に null になる `facts` オブジェクトです。Python の `locale_facts(profile_id)` は情報を直接返します。

::: code-group

```ts [WASM / Native Node]
const result = wb.localeFacts('mac-365-de_DE')
if (!result.status.ok || !result.facts) throw new Error(result.status.message)
const facts = result.facts
console.log(facts.decimalSeparator, facts.listSeparator) // , ;
console.log(facts.trueName, facts.falseName) // WAHR FALSCH
```

```python [Python]
facts = wb.locale_facts("mac-365-de_DE")
print(facts.decimal_separator, facts.list_separator)  # , ;
print(facts.true_name, facts.false_name)  # WAHR FALSCH
```

:::

桁区切りと配列の区切り文字、日付の並び順、真偽値名、通貨の位置と既定の小数桁数、翻訳済みエラー名も含まれます。`measured` は、プロファイルの基本情報を Excel で実測したかどうかを示します。`collationMeasured`（Python は `collation_measured`）は別の項目で、すべての `mac-*` プロファイルでは `true`、すべての `win-*` プロファイルでは `false` です。`win-365-ja_JP` は基本情報の `measured` が `true` でも、照合の `collationMeasured` は `false` です。エラー名には項目ごとの `measured` があるため、実測済みプロファイルでもすべてのエラー表記が実測済みとは限りません。

## 計算の挙動を選ぶ

新しく作成するワークブックでは `Workbook.createDefault()` / `create_default()` が `win-365-en_US` を使います。別のプロファイルを選び、そのプロファイルの新規作成用テンプレート既定値も適用する場合は `createForProfile(profileId)` / `create_for_profile(profile_id)` を使います。[28 種類のプロファイル ID](/ja/compatibility/locale-profiles)があります。プロファイルは数値・日付文字列の解析、通貨書式、コードページ、文字列の照合と並び順、ピボットテーブルのラベルに影響します。保存数式が同じでも、結果が変わる場合があります。

`setExcelProfileId()` はプロファイルを変更し、数式を再計算待ちにします。結果を読む前に `recalc()` を呼び出してください。別のプロファイルを指定して数式を翻訳するだけなら、戻り値の文字列だけが変わります。プロファイルは XLSX・XLSB に保存されません。ファイルと一緒に保存し、読み込み後に適用し直してください。

UI ライブラリの `SpreadsheetProfileId` は `mac-de_DE`・`windows-de_DE` のような名前を使い、エンジンの `ExcelProfileId` は `mac-365-de_DE`・`win-365-de_DE` を使います。それぞれの API に対応する ID を渡してください。

## シート名の引用符とシート修飾付きの数式テキスト

保存される数式は、英語の規則でシート名を引用符で囲みます。数字や `.` で始まる名前、`TRUE` / `FALSE`、セルアドレスや R1C1 参照の形をした名前、英数字・`.`・`_`・非 ASCII 文字（U+3000 を除く）以外を含む名前が対象です。`ADDRESS` は表示用のテキストを作るため、有効なプロファイルの規則で判断します。プロファイル固有の R1C1 の文字（de_DE の `Z` と `S`）と論理値名が対象になり、U+3000 で引用符が必要になるのは全角（ダブルバイト）ロケールだけです。別シートのセルに対する `CELL("address")` は、シート名をそのまま付けず、ブック間参照の規則で修飾します。

`SINGLE` / `ANCHORARRAY` を `@` / `#` で表示する数式や、暗黙の `@` を補う数式は、日本語のシート名や文字列リテラルのような非 ASCII テキストを含んでいても正しく書き出されます。スピルの起点ではないセルに対する `ANCHORARRAY` は、解析できない `x#` にならず、呼び出しの表記のまま保たれます。

## 動的な言語切り替えを試す

実際の Cell UI とエンジンを使うデモです。マウント済みのシートで言語を変え、現在のプロファイル、表示数式、保存数式を比べてください。編集内容は同じワークブックに残ります。ホスト側の操作、設定の保存、切り替え失敗時の扱いは[言語切り替えガイド](/ja/cell/language-switching)で説明します。

<LocaleSwitchDemo />

## 次に読むもの

- [ロケールプロファイル](/ja/compatibility/locale-profiles) — 対応するプラットフォームと言語。
- [文字列の比較と並べ替え](/ja/compatibility/text-collation) — 照合と並び順がプロファイルに依存する理由。
- [国際化](/ja/cell/i18n) — UI 辞書とアプリ固有のラベル。
