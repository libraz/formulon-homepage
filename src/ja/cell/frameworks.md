---
title: React / Vue アダプタ
description: formulon-cell の framework パッケージが提供する <Spreadsheet> / <SpreadsheetToolbar> コンポーネント、hooks / composables、error / strings プロパティ。
---

# フレームワークアダプタ

`@libraz/formulon-cell-react` と `@libraz/formulon-cell-vue` は、vanilla の `@libraz/formulon-cell` core をフレームワーク流のプロパティ、イベント、状態フックで包みます。どちらも薄い層です ─ マウント、dispose、リボンの挙動はすべて core にあるため、2 つのアダプタは同じ形を鏡写しにし、互いに同期し続けます。`formulon-cell` の他の部分と同じく、結合試験と実装例のための参考品質の wrapper であり、堅牢化された本番向けコンポーネントライブラリではありません。

## `<Spreadsheet>`

| プロパティ | 型 | 補足 |
| --- | --- | --- |
| `workbook` | `WorkbookHandle` | 読み込み済みワークブック。省略時は新規のデフォルトワークブックを作成 |
| `ui` | `SpreadsheetUiOptions` | プリセット + 機能スイッチの簡易指定。`theme` / `features` と両方渡した場合はそちらが優先 |
| `theme` | `MountOptions['theme']` | 変更時に `instance.setTheme()` を呼ぶ。再マウントなし |
| `locale` | `MountOptions['locale']` | 変更時に `instance.i18n.setLocale()` を呼ぶ |
| `strings` | `MountOptions['strings']` | 文字列単位の上書き。`i18n.extend()` 経由で適用 |
| `features` | `FeatureFlags` | 組み込み機能を個別に on/off |
| `extensions` | `ExtensionInput[]` | 組み込みと並べて / 代わりにマウントするカスタム拡張 |
| `functions` | `MountOptions['functions']` | `instance.formula` に登録するホスト側カスタム関数 |
| `seed` | `MountOptions['seed']` | セル初期投入のコールバック（主にデモ用） |
| `printerProfiles` | `readonly PrinterProfile[]` | [ホスト統合](/ja/cell/host-integration#プリンタプロファイル-api) 参照 |
| `printerProfileId` | `string` | アクティブなホスト側プリンタプロファイル id |
| `refreshPrinterProfiles` | `MountOptions['refreshPrinterProfiles']` | ネイティブ / Electron のプリンタ検出フック |
| `captureScreenClip` | `MountOptions['captureScreenClip']` | 挿入 > スクリーンショット > 画面の領域 を支えるフック |
| `uploadStatus` | `MountOptions['uploadStatus']` | ステータスバーのアップロード状態インジケータ |
| `macroRecording` | `MountOptions['macroRecording']` | ステータスバーのマクロ記録インジケータ |
| `errorFallback` | React: `ReactNode \| ((error: unknown) => ReactNode)` · Vue: `(error: unknown) => VNodeChild` | マウントが reject したときに表示するフレームワークネイティブな UI |
| `className` / `style`（React）、`class` / `style`（Vue） | — | ホスト要素へ転送 |

ランタイムのプロパティ変更は、再マウントではなく命令的 API 経由で適用されます ─ `theme`、`locale`、`strings`、`workbook`、`features`、`extensions`、`printerProfiles`、`printerProfileId`、`uploadStatus`、`macroRecording` はいずれも動作中のインスタンスをその場で更新するため、選択範囲、フォーカス、イベント購読はプロパティ変更をまたいで生き残ります。

### React

```tsx
import { Spreadsheet, presets } from '@libraz/formulon-cell-react'

<Spreadsheet
  features={presets.standard()}
  locale="ja"
  theme="paper"
  onReady={(instance) => console.log('mounted', instance.workbook.version)}
  onCellChange={(e) => console.log(e)}
  onSelectionChange={(e) => console.log(e.active)}
  onWorkbookChange={(e) => console.log(e)}
  onLocaleChange={(e) => console.log(e)}
  onThemeChange={(e) => console.log(e)}
  onRecalc={(e) => console.log(e)}
  onError={(err) => showConfigurationError(err)}
  errorFallback={(err) => <ConfigErrorPanel error={err} />}
/>
```

`SpreadsheetRef` は命令的アクセスのための生きたインスタンスを公開します。

```tsx
const ref = useRef<SpreadsheetRef>(null)
ref.current?.instance?.undo()
```

### Vue

```vue
<script setup lang="ts">
import { Spreadsheet, presets } from '@libraz/formulon-cell-vue'
</script>

<template>
  <Spreadsheet
    :features="presets.standard()"
    locale="ja"
    theme="paper"
    @ready="(inst) => console.log('mounted', inst.workbook.version)"
    @cell-change="(e) => console.log(e)"
    @selection-change="(e) => console.log(e.active)"
    @workbook-change="(e) => console.log(e)"
    @locale-change="(e) => console.log(e)"
    @theme-change="(e) => console.log(e)"
    @recalc="(e) => console.log(e)"
    @error="(err) => showConfigurationError(err)"
    :error-fallback="(err) => h(ConfigErrorPanel, { error: err })"
  />
</template>
```

Vue コンポーネントは `{ instance }` を `expose()` してテンプレート ref から使えるようにしており、React の `SpreadsheetRef` と同じ形です。

## `<SpreadsheetToolbar>`

core の `Spreadsheet.mountToolbar` の薄いアダプタです ─ リボンの DOM、メニューファクトリ、activation モデル、dropdown ディスパッチャはすべて core にあり、framework パッケージが独自のリボン実装を持つことはありません。

| プロパティ | 型 | 補足 |
| --- | --- | --- |
| `instance` | `SpreadsheetInstance \| null` | リボンを取り付けるマウント済みスプレッドシート |
| `activeTab` | `RibbonTab` | 制御されたアクティブタブ |
| `onTabChange` / `@tab-change` | `(tab: RibbonTab) => void` | リボンのタブが変わると発火 |
| `locale` | `string` | `'en'` 以外は `'ja'` として扱う |
| `dropdownActions` | `Partial<DynamicDropdownsCtx>` | リボンを fork せずに個々の dropdown ハンドラ（並べ替え、保護、ファイルピッカー、スクリプト / アドインのアクションなど）を上書き |
| `ribbonTabs` | `readonly RibbonTab[]` | 共有のタブ面 ─ ベースラインプロファイルには `EXCEL365_STANDARD_RIBBON_TABS`、自動化タブを足すには `OPTIONAL_RIBBON_TABS` を追記 |
| `onSpellingReview`, `onAccessibilityCheck`, `onTranslate` | `() => void` | 校閲タブのフック |
| `onRunScript`, `onAddIn` | `() => void` | スクリプト / アドインの dropdown で「カスタム」「管理」アクションを選ぶと発火 |
| `onDrawPen`, `onDrawEraser` | `() => void` | 描画タブのインクモードフック |
| `onError` | `(error: unknown) => void` | core ツールバーのマウントに失敗すると発火 |
| `onToolbarReady` | `(toolbar: ToolbarInstance \| null) => void` | マウント済みの core toolbar インスタンスを受け取る。DOM のボタンを探さずに共有コマンド（タイトルバー検索、Tell Me）をディスパッチできる |

```tsx
<SpreadsheetToolbar
  instance={instance}
  activeTab={activeTab}
  locale="ja"
  onTabChange={setActiveTab}
  dropdownActions={{ applyProtectAction: openProtectDialog }}
/>
```

両フレームワークでのより完全なマウント例と、React / Vue を使わないホスト向けの手動 `Spreadsheet.mountToolbar()` は [埋め込みガイドのリボンツールバー節](/ja/cell/embedding#リボンツールバー) を参照してください。

## Hooks / composables

両パッケージは、自前でストア購読を組まずにインスタンス状態を読むための同じ 4 つのプリミティブを export しています。React 側は hooks（`useSyncExternalStore` ベース）、Vue 側は composables（`watchEffect` ベースで `Ref` を返す）です。

| React | Vue | シグネチャ | 説明 |
| --- | --- | --- | --- |
| `useSelection(instance)` | `useSelection(instance)` | `(instance: SpreadsheetInstance \| null) => Selection`（React）/ `(instance: Ref<SpreadsheetInstance \| null>) => Ref<Selection>`（Vue） | アクティブな選択範囲を購読 |
| `useSpreadsheet(instance, selector, fallback)` | `useSpreadsheet(instance, selector, fallback)` | `<T>(instance, selector: (state: State) => T, fallback: T) => T`（React）/ `=> Ref<T>`（Vue） | ストアの `State` に対するセレクタを購読。インスタンスが null の間は SSR 安全な fallback を返す |
| `useI18n(instance)` | `useI18n(instance)` | React: `=> { locale: string; strings: Strings \| null }` · Vue: `=> { locale: Ref<string>; strings: Ref<Strings> }` | 現在のロケールと strings。ランタイムの `setLocale`/`extend`/`register` に反応 |
| `useSpreadsheetEvent(instance, event, handler)` | `useSpreadsheetEvent(instance, event, handler)` | `<K extends SpreadsheetEventName>(instance, event: K, handler: SpreadsheetEventHandler<K>) => void` | ライフサイクルイベント（`cellChange`、`selectionChange`、`workbookChange`、`localeChange`、`themeChange`、`recalc`）を購読。handler の参照はレンダー間で変わっても再購読しない |

```tsx
// React
import { useSelection, useI18n, useSpreadsheetEvent } from '@libraz/formulon-cell-react'

const selection = useSelection(instance)
const { locale, strings } = useI18n(instance)
useSpreadsheetEvent(instance, 'cellChange', (e) => console.log(e))
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { useSelection, useI18n, useSpreadsheetEvent } from '@libraz/formulon-cell-vue'

const selection = useSelection(instance)
const { locale, strings } = useI18n(instance)
useSpreadsheetEvent(instance, 'cellChange', (e) => console.log(e))
</script>
```

`useSelection` と `useSpreadsheet` は、`instance` が `null` の間（マウント前や `dispose()` 後）はニュートラルな `Selection` / `fallback` 値にフォールバックするため、コンポーネントは読み取りのたびに null チェックせずにスプレッドシートの準備前から描画できます。

## `errorFallback` プロパティ / `error` イベント

`Spreadsheet.mount()` はインスタンスを作れないと reject します ─ 最も多いのは WASM エンジンが起動できないときです（[SharedArrayBuffer が無いと reject する](/ja/cell/index#sharedarraybuffer-が無いと-reject-する) 参照）。両アダプタはこれを未処理の promise rejection にせず、`onError`（React のプロパティ）/ `error`（Vue の emit）と、フレームワークネイティブな代替 UI を出す `errorFallback` プロパティとして表面化します。`errorFallback` を渡すと、core 自身のエラーパネル（`renderError`）は自動的に抑止されます。vanilla パッケージでの同じ契約は [埋め込みガイドのライフサイクルフック](/ja/cell/embedding#ライフサイクルフック) を参照してください。

## `strings` プロパティ

`strings` プロパティは、自分で `instance.i18n.extend(locale, strings)` を呼ぶことの宣言的な等価物です ─ マウント直後に 1 回適用され、プロパティが変わるたびに再適用されます。i18n コントローラを命令的に呼ぶ代わりに、他のマウントプロパティと並べて文字列単位の上書きを宣言したいときに使ってください。辞書の形は [i18n](/ja/cell/i18n#fork-せず上書きする) を参照してください。

## 次に読むもの

- [埋め込みガイド](/ja/cell/embedding) ─ マウント形、プリセット / 拡張、コマンドヘルパー、リボンツールバー
- [ホスト統合](/ja/cell/host-integration) ─ これらのコンポーネントが転送するステータスバー / プリンタプロファイルのプロパティ
- [i18n](/ja/cell/i18n) ─ ロケール登録と `strings` 上書きの形
