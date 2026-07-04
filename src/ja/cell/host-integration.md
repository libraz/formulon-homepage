---
title: ホスト統合の境界
description: ホストアプリが formulon-cell の SpreadsheetInstance 経由で駆動するステータスバーのアップロード / マクロ記録状態とプリンタプロファイル API。
---

# ホスト統合

Excel 365 風 chrome の一部は、ホストアプリケーションにしか提供できないデータを必要とします ─ クラウド同期 / 保存の状態、マクロ記録の状態、物理プリンタの能力です。`formulon-cell` の core が持つのは表示と配線だけで、この状態を自分ででっち上げることはありません。このページはその境界を、結合試験ハーネスの上に組むホストのための参考としてまとめたものです ─ 本番サポートの契約ではありません。

::: info 用語: core とホスト
*core* は `@libraz/formulon-cell` とその React / Vue アダプタ ─ chrome、ストア、エンジン結合です。*ホスト* はあなたのアプリケーション ─ 保存が実際に成功したか、マクロレコーダが動いているか、どのプリンタが物理的に接続されているかを知っているコードです。core はホストから渡された状態を読むだけで、自分から外の世界へ問い合わせることはありません。
:::

## ステータスバー: アップロード状態とマクロ記録

ステータスバーには、ホスト駆動のバッジを 2 つ表示できます ─ アップロード状態インジケータとマクロ記録インジケータです。どちらもホストが値を渡すまでは非表示です。

```ts
type StatusBarUploadStatus = 'saved' | 'saving' | 'error' | null
// macroRecording には独立した export 型エイリアスがない ─ 現れる場所すべてで
// `boolean | null`（MountOptions.macroRecording、setMacroRecording の引数）。
```

| 値 | 意味 |
| --- | --- |
| `'saved'` | 直近の保存 / 同期が成功した |
| `'saving'` | 保存 / 同期が進行中 |
| `'error'` | 直近の保存 / 同期が失敗した |
| `null` / `undefined` | ホストに報告すべきアップロード状態が無い ─ バッジ非表示 |

| 値 | 意味 |
| --- | --- |
| `true` | マクロ記録が実行中 |
| `false` | 記録は可能だが現在停止中 ─ 「マクロの記録」として表示 |
| `null` / `undefined` | ホストがマクロ記録を公開していない ─ バッジ非表示 |

### エントリポイント

どちらもマウント時に設定し、実行時は同じ 2 つのメソッドで更新します。

```ts
const instance = await Spreadsheet.mount(host, {
  uploadStatus: 'saving',
  macroRecording: false
})

instance.setUploadStatus('saved')
instance.setUploadStatus('error')
instance.setUploadStatus(null)

instance.setMacroRecording(true)
instance.setMacroRecording(false)
instance.setMacroRecording(null)
```

React / Vue は同じ状態をプロパティとして公開し（[フレームワークアダプタ](/ja/cell/frameworks) 参照）、プロパティ変更をこれらと同じ setter に転送します。framework パッケージが独自のステータスバーを実装することはありません。

```tsx
<Spreadsheet uploadStatus={syncState} macroRecording={isRecordingMacro} />
```

```vue
<Spreadsheet :upload-status="syncState" :macro-recording="isRecordingMacro" />
```

### 責務の分担

| core | ホスト |
| --- | --- |
| `uploadStatus` / `macroRecording` をステータスバーに描画 | 実際のクラウド保存 / 自動保存 / 共同編集の状態を `uploadStatus` へ変換 |
| ステータスバーのチューザで各バッジの表示 / 非表示を切替 | 実際のマクロレコーダ / ネイティブ自動化 / スクリプトレコーダを `macroRecording` へ変換 |
| 値が `null` / `undefined` のバッジを常に隠す | ワークブック切替、保存開始、保存完了、保存失敗、記録開始 / 停止のたびに setter を呼ぶ |

```ts
const sheet = await Spreadsheet.mount(host, {
  uploadStatus: cloudSave.currentStatus(),
  macroRecording: macroRecorder.isAvailable() ? macroRecorder.isRecording() : null
})

cloudSave.on('saving', () => sheet.setUploadStatus('saving'))
cloudSave.on('saved', () => sheet.setUploadStatus('saved'))
cloudSave.on('error', () => sheet.setUploadStatus('error'))

macroRecorder.on('start', () => sheet.setMacroRecording(true))
macroRecorder.on('stop', () => sheet.setMacroRecording(false))
macroRecorder.on('unavailable', () => sheet.setMacroRecording(null))
```

この例の `cloudSave` と `macroRecorder` はホスト所有です。同種のものは core には同梱されていません。

## プリンタプロファイル API

ブラウザの印刷 API は物理プリンタの印刷不能マージンを公開しないため、ページ設定と組み込みの印刷 / PDF フローは、ホストが把握しているプリンタの `PrinterProfile` データ供給に依存します。

```ts
interface PrinterProfile {
  id?: string
  name?: string
  paperSize?: 'A4' | 'A3' | 'A5' | 'letter' | 'legal' | 'tabloid'
  orientation?: 'portrait' | 'landscape'
  printableBounds: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}
```

`printableBounds` の単位はインチで、各用紙端からの印刷不能な最小インセットを表します（例: `left: 0.17` は左端 0.17 インチには印刷できないという意味）。

### エントリポイント

```ts
const instance = await Spreadsheet.mount(host, {
  printerProfiles,
  printerProfileId,
  refreshPrinterProfiles
})

instance.setPrinterProfiles(nextProfiles)
instance.setPrinterProfileId(nextPrinterId)
await instance.refreshPrinterProfiles()
```

React / Vue は対応する `printerProfiles`、`printerProfileId`、`refreshPrinterProfiles` プロパティを公開し（[フレームワークアダプタ](/ja/cell/frameworks) 参照）、これらと同じ setter に転送します。framework 層に独立したプリンタ API はありません。

`refreshPrinterProfiles` は `PrinterProfile[] | undefined` を、同期または `Promise` 経由で返します。`undefined` は「更新できなかったので既存のプロファイルを維持」、空配列は「プロファイルが無いことをホストが確認した」という意味です。

### 正規化

core はホストから渡されたものを正規化します ─ `id` / `name` を trim（空白のみは未設定扱い）、未知の `paperSize` / `orientation` 値を破棄、`printableBounds` を非負の数値で補完し、プロファイルを重複排除します（`id` があれば `id`、無ければ `name` + `paperSize` + `orientation` で判定）。同じ正規化が欲しいホストは、再実装せずに直接呼べます: `normalizePrinterProfile()`、`normalizePrinterProfileId()`、`normalizePrinterProfiles()`。

### プロファイル選択

`resolvePrinterProfileBounds(setup, profiles, preferredId)` は次の順でプロファイルを選びます。

1. `preferredId` に一致し、**かつ** 現在の用紙サイズ / 向きにも一致
2. `preferredId` に一致
3. 現在の用紙サイズと向きの両方に一致
4. 現在の用紙サイズに一致
5. 現在の向きに一致
6. 最初の候補

何も一致しない場合、core はホスト提供の bounds を一切適用しません ─ シートに保存済みの `PageSetup.printableBounds` へ、それも無ければインセット `0` へフォールバックします。

### Electron / ネイティブホストの例

```ts
import { type PrinterProfile, printerProfilesFromHostDevices } from '@libraz/formulon-cell'

async function loadPrinterProfiles(): Promise<readonly PrinterProfile[]> {
  const devices = await window.nativePrinters.list()
  return (
    printerProfilesFromHostDevices(
      devices.map((device) => ({
        id: device.id,
        name: device.name,
        paperOptions: device.paperOptions.map((paper) => ({
          id: paper.id,
          label: paper.label,
          paperSize: paper.size,
          orientation: paper.orientation,
          hardwareMarginsInches: paper.hardwareMarginsInches
        }))
      }))
    ) ?? []
  )
}

const instance = await Spreadsheet.mount(host, {
  printerProfiles: await loadPrinterProfiles(),
  refreshPrinterProfiles: loadPrinterProfiles
})
```

`window.nativePrinters` はホスト所有の境界で、core がプリンタを列挙することはありません。`printerProfilesFromHostDevices()` は、デバイス / 用紙オプションの id、name / label、用紙サイズ、向き、`hardwareMarginsInches`（または `printableBounds`）を `PrinterProfile[]` に変換し、`normalizePrinterProfiles()` と同じ重複排除と bounds 正規化を適用します。

### 責務の分担

| core | ホスト |
| --- | --- |
| 受け取った `PrinterProfile` データを正規化 | OS / Electron / ネイティブ API でプリンタと印刷可能領域を列挙 |
| 現在の用紙サイズ / 向きに最も合うプロファイルを選択 | そのデータを `PrinterProfile` の形へ変換 |
| 選ばれたプロファイルをページ設定の表示、警告、印刷 / PDF 出力へ反映 | ユーザーがプリンタ / 用紙 / 向きを変えたら `setPrinterProfiles` / `setPrinterProfileId` を呼ぶ |
| 一致プロファイルが無ければシート保存値かインセット `0` へフォールバック | 「ドライバ値が取得できない」はプロファイル無しとして表現し、値をでっち上げない |

### UI のフォールバック挙動

一致するプロファイルが無い場合: ページ設定のプリンタセレクタは非表示になり（`refreshPrinterProfiles` が使えるときだけ更新の導線が出ることはあります）、余白タブの「プリンタの最小余白」は、シートに保存済みの `printableBounds` が無い限り `0` を表示します。プロファイルがある場合: セレクタはホスト提供の `name` を優先し、無ければ `id` か用紙 / 向きのラベルへフォールバックします。用紙、向き、プロファイルを変えると `printableBounds` がシートのページ設定へ解決し直され、印刷出力にはユーザー指定の余白と印刷可能 bounds の大きい方が使われます。

## 次に読むもの

- [フレームワークアダプタ](/ja/cell/frameworks) ─ これらの setter へ転送する React / Vue プロパティ
- [API 一覧](/ja/cell/api) ─ `SpreadsheetInstance` のその他の面
- [埋め込みガイド](/ja/cell/embedding) ─ マウント形とライフサイクルフック
