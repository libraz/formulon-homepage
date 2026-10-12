---
title: 言語を切り替える
description: 利用者の言語変更に合わせて、formulon-cell の表示文言、数式構文、ワークブックプロファイル、ホスト側 UI を同期します。
---

# 言語を切り替える

`formulon-cell` はグリッド周辺のラベルだけを変えるわけではありません。組み込みロケールを選ぶと、UI 辞書と対応する Formulon のワークブックプロファイルも切り替わるため、数値形式、日付、真偽値、区切り文字、数式バーの文字列が同じ設定に従います。関数名はプロファイルに別名がある場合だけ変換され、中国語、韓国語、タイ語では保存用の英語名が維持されます。ホスト側から切り替えるときは、マウント済みの `SpreadsheetInstance` を使います。`instance.locale` が確定済みのロケールを返し、`instance.setLocale(locale)` が変更を受け付けたかを返します。

## 一連の動作を試す

::: info 現行リリース
このページは cell の現行リリースに対応しています。3 つのパッケージを同じバージョンで固定してインストールします。

```sh
npm install @libraz/formulon-cell@0.9.0 @libraz/formulon-cell-react@0.9.0 @libraz/formulon-cell-vue@0.9.0
```

各パッケージは `@libraz/formulon@0.15.1` を使い、Node.js 22 以降が必要です。peer dependency とクイックスタートは [インストール](/ja/cell/install) を参照してください。
:::

<LocaleSwitchDemo />

このデモでは、ワークブックをマウントしたまま、セレクター、UI のラベル、ワークブックプロファイル、計算結果、ローカライズされた入力を順に切り替えます。ワークブックに保持された正規数式と、ローカライズされた表示を比較できます。モーダル、検索と置換、コメント編集、フィルターメニュー、Mac の関数の引数パレットが開いている場合と、エンジンがプロファイル変更を拒否した場合の動作は、以下で説明します。

## 初期ロケールと切り替え UI を設定する

マウント時には、組み込みの短い ID または正しい言語・地域タグを渡します。組み込みセレクターは、アプリケーションが独自の言語メニューを持つ場合に備えて、明示的に有効にします。

```ts
import { Spreadsheet, WorkbookHandle } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const workbook = await WorkbookHandle.createDefault({ locale: 'de-DE' })
const instance = await Spreadsheet.mount(host, {
  workbook,
  locale: 'de-DE',
  ui: {
    profile: 'excel365',
    features: { localeSwitcher: true },
  },
})

console.log(instance.locale) // 'de-DE'
console.log(instance.workbook.spreadsheetProfileId()) // 'windows-de_DE'
```

組み込み辞書は `en`、`ja`、`de`、`fr`、`zh`、`ko`、`th` の 7 つです。対応するプロファイルの接尾辞は `en_US`、`ja_JP`、`de_DE`、`fr_FR`、`zh_CN`、`ko_KR`、`th_TH` です。`default` プラットフォームでは公開プロファイル ID が `windows-*`、`mac` では `mac-*` になります。エンジン内部の ID は `win-365-*` と `mac-365-*` です。

| UI ロケール | 辞書 | default プラットフォーム | Mac プラットフォーム |
| --- | --- | --- | --- |
| `en` または `en-US` | English | `windows-en_US` | `mac-en_US` |
| `ja` または `ja-JP` | 日本語 | `windows-ja_JP` | `mac-ja_JP` |
| `de` または `de-DE` | Deutsch | `windows-de_DE` | `mac-de_DE` |
| `fr` または `fr-FR` | Français | `windows-fr_FR` | `mac-fr_FR` |
| `zh` または `zh-CN` | 中文 | `windows-zh_CN` | `mac-zh_CN` |
| `ko` または `ko-KR` | 한국어 | `windows-ko_KR` | `mac-ko_KR` |
| `th` または `th-TH` | ไทย | `windows-th_TH` | `mac-th_TH` |

組み込み言語を基底に持つ正しい地域タグは、同じプロファイル接尾辞へマッピングされます。たとえば `en-GB` は英語の `windows-en_US` または `mac-en_US` プロファイルを使います。`instance.locale` には指定したタグが確定値として残り、組み込みセレクターでは短い `en` の選択肢として表示されます。script、variant、private-use タグはカスタム ID のままで、プロファイルを選びません。

`localeSwitcher` は full プロファイルでも初期状態では無効です。`ui.features.localeSwitcher: true` で有効にするか、マウント後に `instance.setFeatures({ localeSwitcher: true })` を呼びます。`policy` を指定したマウントでは組み込み UI がポリシーで許可された編集面に制限され、セレクターも無効になります。ポリシーを使う場合はホスト側の言語コントロールから `instance.setLocale()` を呼び出してください。

## ホスト側から切り替える

```ts
function changeLanguage(next: string) {
  if (!instance.setLocale(next)) {
    showLanguageError('スプレッドシートは現在の言語を維持しました。')
    return
  }

  savePreference(instance.locale)
  renderProfile(instance.workbook.spreadsheetProfileId())
}

const off = instance.on('localeChange', ({ locale }) => {
  languageMenu.value = locale
})
```

`setLocale()` はマウント済みインスタンスから見ると原子的に動作します。プロファイルを変える前に、インライン編集または数式バーの編集を現在のロケールで確定します。表示中のモーダル、検索と置換、コメント編集、フィルターメニューが開いている場合も切り替えを拒否し、`false` を返して画面、その下書き、現在のロケールを保持します。次にワークブックのプロファイルを変更し、読み戻してから 1 回だけ再計算します。編集を確定できない、エンジンがプロファイルを拒否する、読み戻した値が想定外になる、または再計算に失敗した場合は、マウントが以前のプロファイルと UI ロケールを復元して `false` を返します。成功時は `true` です。同じロケールをもう一度指定した場合も成功しますが、再計算は行いません。

Mac では、開いている関数の引数パレットが数式の下書きを所有しています。この下書きをその場で翻訳できないため、`setLocale()` は `false` を返し、パレットと下書きを開いたまま以前のロケールを維持します。パレットを閉じるか編集を確定してから、もう一度切り替えてください。

`instance.i18n.setLocale()` もマウント済み UI を通知します。辞書や拡張のコードでは便利ですが、ホストのメニューからは成功・失敗を受け取れる `instance.setLocale()` を使う方が安全です。辞書の登録、拡張、購読は [国際化](/ja/cell/i18n) にまとめています。

## カスタム ID と地域タグ {#custom-ids-and-regional-tags}

辞書の解決では、BCP 47 またはアンダースコア形式のタグから言語部分を取り出します。そのため `en-US`、`en_US`、`en` はすべて英語辞書になります。`de-brand` のように登録した ID にはホスト独自の完全な辞書を使えます。辞書を登録していない場合も、言語部分が `de` なので組み込みドイツ語辞書へフォールバックします。ただし、ワークブックプロファイルは切り替わりません。`de-Latn-DE`、`de-DE-posix`、`x-private` のような script、variant、private タグもカスタム UI ID として扱われ、数式の意味を暗黙には変えません。組み込みの言語部分を持たない未登録 ID は、既定の日本語辞書へ解決されます。

```ts
import { type Strings } from '@libraz/formulon-cell'

const brandStrings: Strings = loadBrandDictionary()
instance.i18n.register('de-brand', brandStrings)

// 表示文言は登録辞書を使います。カスタム ID には組み込み
// プロファイルがないため、ワークブックのプロファイルは変わりません。
instance.setLocale('de-brand')
```

カスタム辞書を使いながらドイツ語の数式意味論も選びたい場合は、ワークブック用に `de` または `de-DE` へ切り替え、表示文言には `instance.i18n.extend('de', overlay)` を使います。エンジン側のプロファイルと変換規則は [ワークブックの言語と数式プロファイル](/ja/workbook/language) を参照してください。

## 数式、値、入力の動作 {#formula-value-and-input-behavior}

UI はアクティブなプロファイルを使って編集と表示を行います。ドイツ語のエディターへ `=SUMME(1,5;2)` を入力すると、移植可能な正規数式 `=SUM(1.5,2)` として保存され、ロケール変更後には表示も再びローカライズされます。ドイツ語の間は計算結果が `3,5` と表示され、切り替え後は新しい数値形式に従います。

```ts
const address = { sheet: 0, row: 0, col: 0 }

// 数式バー、インラインエディター、クリップボード入力は
// アクティブなプロファイルを使います。UI が完全なローカライズ数式を
// 正規化してから書き込みます。
typeIntoSpreadsheet('=SUMME(1,5;2)')
console.log(instance.workbook.cellFormula(address)) // '=SUM(1.5,2)'
console.log(instance.workbook.getValue(address)) // { kind: 'number', value: 3.5 }
```

`WorkbookHandle.setFormula()` はプログラムから呼ぶ書き込み境界です。直接書く場合は正規数式を渡してください。互換用の経路ではローカライズされた関数名を変換できますが、区切り文字、十進リテラル、真偽値、エラー名、引用文字列を完全には変換しません。外部フォームやファイルから完全なローカライズ数式を受け取ったときは、明示的に変換してから書き込みます。

```ts
const localized = '=SUMME(1,5;2)'
const canonical = instance.workbook.canonicalizeLocalizedFormula(localized)

instance.workbook.setFormula(address, canonical)
console.log(canonical) // '=SUM(1.5,2)'
```

ほかのホスト側表示には、対応する読み取りメソッドを使います。

```ts
const display = instance.workbook.localizeFormulaText('=SUM(1.5,2)')
const facts = instance.workbook.localeFacts()
// facts.listSeparator、facts.decimalSeparator、真偽値名、日付順など
```

`getFormulaForDisplay()` は数式バーとインラインエディター用に、同じ完全な数式ローカライズを使います。`localizeFormulaText()` と `canonicalizeLocalizedFormula()` には、アクティブなプロファイル以外の公開プロファイル ID も指定できます。インストールされたエンジンが完全な数式ロケール機能を持たない場合は関数名の変換へフォールバックし、ほかの文字列はそのまま残ります。必要に応じて `workbook.capabilities.formulaLocale` と `workbook.capabilities.localeFacts` を確認してください。

## React、Vue、拡張、ホスト側フック

アダプターは `locale`、`strings`、`ui.features.localeSwitcher` を同じマウント処理へ渡します。`onReady` / `ready` で受け取ったインスタンスを保存し、ホスト側のコントロールから `setLocale()` を呼び出します。

::: code-group

```tsx [React]
import { useState } from 'react'
import { Spreadsheet, type SpreadsheetInstance } from '@libraz/formulon-cell-react'

export function LanguageControl() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)

  return (
    <>
      <Spreadsheet
        locale="en"
        ui={{ profile: 'embedded', features: { localeSwitcher: false } }}
        onReady={setInstance}
        onLocaleChange={({ locale }) => savePreference(locale)}
      />

      <button disabled={!instance} onClick={() => instance?.setLocale('ja')}>
        日本語
      </button>
    </>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { shallowRef } from 'vue'
import { Spreadsheet, type SpreadsheetInstance } from '@libraz/formulon-cell-vue'

const instance = shallowRef<SpreadsheetInstance | null>(null)
</script>

<template>
  <Spreadsheet
    locale="en"
    :ui="{ profile: 'embedded', features: { localeSwitcher: false } }"
    @ready="instance = $event"
    @locale-change="({ locale }) => savePreference(locale)"
  />
  <button :disabled="!instance" @click="instance?.setLocale('ja')">日本語</button>
</template>
```

:::

`useI18n()` と `useSpreadsheetEvent(instance, 'localeChange', handler)`（Vue では対応するコンポーザブル）を使うと、ホスト側コントロールをリアクティブに保てます。拡張はコンテキストの現在の `strings` を読み、i18n コントローラの通知でラベルを更新できます。永続化には `localeChange` を使い、コンポーネント外のサービスでは `instance.on()` が返す解除関数を保持してください。[フックとコンポーザブル](/ja/cell/hooks) と [React / Vue アダプター](/ja/cell/frameworks) に購読の境界をまとめています。

