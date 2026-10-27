---
title: リボンツールバー
description: formulon-cell のリボンをスプレッドシートのホスト内または別の要素にマウントし、タブ、ドロップダウン、コマンドをホストアプリケーションへ接続します。
---

# リボンツールバー

`Spreadsheet.mount()` に `toolbar` を渡すと、同じ呼び出しで数式バーの上にリボンがマウントされます。

```ts
import '@libraz/formulon-cell/styles.css'
import { Spreadsheet, type RibbonTab } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'excel365' },
  toolbar: {
    activeTab: (localStorage.getItem('ribbon-tab') as RibbonTab | null) ?? 'home',
    onTabChange: (tab) => localStorage.setItem('ribbon-tab', tab),
  },
})

instance.toolbar?.setActiveTab('data')
```

`toolbar: true` は既定の設定を使います。オブジェクトを渡す場合は `MountToolbarOptions` で、`Spreadsheet.mountToolbar()` と同じ型です。マウントしたリボンは `instance.toolbar`（`ToolbarInstance`）から操作でき、リボンがなければ `null` です。`toolbar` を省略した場合にリボンを表示するかどうかは `ui` のプロファイルで決まります。[オプション](/ja/cell/options#ui-profile-and-feature-switches) を参照してください。

formulon-cell のほかの部分と同じく、リボンもベータ版です。タブ構成はデスクトップの表計算ソフトにならっていますが、個々のコマンド、ドロップダウン、キーボード操作が一致する保証はありません。完成したエンドユーザー向けのツールバーではなく、アプリケーションに組み込んで評価するための部品として扱ってください。

## インラインのリボンと独立したリボン

| | インライン：マウントオプションの `toolbar` | 独立：`Spreadsheet.mountToolbar()` |
| --- | --- | --- |
| 配置 | スプレッドシートのホストの先頭、数式バーの上。 | タイトルバーやアプリケーションのヘッダーなど、ホストが所有する任意の要素。 |
| ハンドル | `instance.toolbar` | 戻り値の `ToolbarInstance`。 |
| 実行時の変更 | `instance.setToolbar(next)` がリボンを破棄してマウントし直します。`false` で削除します。 | `dispose()` を呼んでマウントし直します。 |
| ドロップダウンメニュー | 操作ポリシーがない間は有効です。`setPolicy()` はリボンを作り直して状態を合わせます。 | `dynamicDropdowns` を渡すまで無効です。 |
| アクセントカラー | グリッドの `--fc-accent` に追従します。 | ツールバーの既定値を使います。ラッパーに `--fc-tb-*` を設定します。 |
| 破棄 | `instance.dispose()` で解放されます。 | インスタンスを破棄する前に `toolbar.dispose()` を呼びます。 |

リボンをレイアウトの別の場所に置く場合は、独立したツールバーを使います。

```ts
import { Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(sheetHost, { ui: { profile: 'excel365' }, toolbar: false })
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  dynamicDropdowns: true,
  onCommand: (id, applied) => {
    if (!applied) handleHostCommand(id)
  },
})

function close() {
  toolbar.dispose()
  instance.dispose()
}
```

`mountToolbar(host, instance, options)` は `host` か `instance` がないと例外を投げます。第 2 引数には `() => SpreadsheetInstance | null` の形の関数も渡せるため、非同期のマウントが終わる前にリボンを描画できます。この関数はコマンドを実行するたびに呼ばれます。インスタンスを返すようになったら `toolbar.rerender()` を 1 回呼び、リボンがそのインスタンスの状態を購読するようにしてください。

リボンの外枠はフレックスアイテムです。フレームワークのコンポーネントは `display: contents` のラッパーを描画し、リボンを親のフレックスコンテナ（縦方向）に参加させます。フレームワークを使わない場合も `toolbarHost` を同じように扱うか、`toolbarHost` 自体を縦方向のフレックスコンテナにしてください。

## React と Vue のコンポーネント

React は `@libraz/formulon-cell-react` から `SpreadsheetToolbar` をエクスポートします。Vue は単一ファイルコンポーネントとして `@libraz/formulon-cell-vue/toolbar.vue` サブパスで公開しており、アプリケーション側の Vue のビルドでコンパイルされます。どちらも `Spreadsheet.mountToolbar()` をラップしたもので、インスタンスは `onReady` または `ready` イベントで受け取ります。

::: code-group

```ts [Vanilla]
import { Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(sheetHost, { ui: { profile: 'excel365' }, toolbar: false })
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  activeTab: 'home',
  dynamicDropdowns: { applyProtectAction: (action) => openProtectDialog(action) },
  hooks: { review: { spelling: () => openSpellChecker() } },
  onTabChange: (tab) => saveActiveTab(tab),
})
```

```tsx [React]
import { useState } from 'react'
import {
  Spreadsheet,
  SpreadsheetToolbar,
  type RibbonTab,
  type SpreadsheetInstance,
  type ToolbarInstance,
} from '@libraz/formulon-cell-react'

// モジュール定数にして参照を固定します。新しいオブジェクトを渡すとリボンがマウントし直されます。
const ui = { profile: 'excel365' } as const
const dropdownActions = {
  applyProtectAction: (action: string) => openProtectDialog(action),
}

export function Editor() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)
  const [tab, setTab] = useState<RibbonTab>('home')
  const [toolbar, setToolbar] = useState<ToolbarInstance | null>(null)

  return (
    <div className="editor">
      <SpreadsheetToolbar
        instance={instance}
        activeTab={tab}
        onTabChange={setTab}
        locale="ja"
        dropdownActions={dropdownActions}
        onSpellingReview={() => openSpellChecker()}
        onToolbarReady={setToolbar}
      />
      <Spreadsheet ui={ui} toolbar={false} onReady={setInstance} />
    </div>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { shallowRef, ref } from 'vue'
import {
  Spreadsheet,
  type RibbonTab,
  type SpreadsheetInstance,
} from '@libraz/formulon-cell-vue'
import SpreadsheetToolbar from '@libraz/formulon-cell-vue/toolbar.vue'

const ui = { profile: 'excel365' } as const
const dropdownActions = {
  applyProtectAction: (action: string) => openProtectDialog(action),
}
const instance = shallowRef<SpreadsheetInstance | null>(null)
const tab = ref<RibbonTab>('home')
</script>

<template>
  <div class="editor">
    <SpreadsheetToolbar
      :instance="instance"
      :active-tab="tab"
      locale="ja"
      :dropdown-actions="dropdownActions"
      :on-spelling-review="openSpellChecker"
      @tab-change="tab = $event"
    />
    <Spreadsheet :ui="ui" :toolbar="false" @ready="instance = $event" />
  </div>
</template>
```

:::

必須のプロパティは `instance`、`activeTab`、`locale` です。React では `onTabChange` も必須で、Vue はタブの変更を `tab-change` イベントで通知します。スプレッドシートの準備ができるまで、`instance` は `null` でかまいません。任意のプロパティは次のとおりです。

| プロパティ | 用途 |
| --- | --- |
| `ribbonTabs` | 表示するタブ。[タブと表示モード](#tabs-and-display) を参照してください。 |
| `dropdownActions` | ドロップダウンの処理を個別に差し替えます。[ドロップダウンの処理](#dropdown-handlers) を参照してください。 |
| `onToolbarReady` | `ToolbarInstance` を受け取ります。リボンを破棄したときやマウントに失敗したときは `null` を受け取ります。 |
| `onError` | リボンのマウントに失敗したときに呼ばれます。Vue は `error` イベントも発行します。 |
| `onSpellingReview`、`onAccessibilityCheck`、`onTranslate`、`onRunScript`、`onAddIn`、`onDrawPen`、`onDrawEraser` | ホスト側のコールバック。[ホスト側のコールバック](#host-callbacks) を参照してください。 |

コンポーネントは `locale` からリボンの言語を決め、`instance`、`locale`、`dropdownActions`、`ribbonTabs` のいずれかが変わるとマウントし直します。`activeTab` の変更はマウントし直さずに `setActiveTab()` へ渡します。`dropdownActions` と `ribbonTabs` には参照が変わらない値（モジュール定数、`useMemo`、`setup` で一度だけ作った値）を渡してください。

## MountToolbarOptions

すべての項目が任意なので、`{}` も有効なオプションです。

### プラットフォームとラベル

| 項目 | 意味 |
| --- | --- |
| `platform` | `default`、`mac`、`auto`。省略すると、ホスト要素、最も近い `.fc-host`、インスタンスのホストの順に `data-fc-platform` を引き継ぎ、その後のインスタンスのプラットフォーム変更にも追従します。 |
| `lang` | 組み込みラベルのロケール。既定ではインスタンスのロケールを使い、`setLocale()` に追従します。明示した `lang` は固定されます。 |
| `text`、`menuText` | 自動で作られる `ToolbarText`（ボタンのタイトル、グループ名）と `ToolbarMenuText`（ドロップダウンのラベル）を置き換えます。 |

### タブと初期状態

| 項目 | 既定値 | 意味 |
| --- | --- | --- |
| `activeTab` | `'home'` | 最初に選ぶ `RibbonTab`。表示するタブに含まれない場合は先頭のタブになります。 |
| `ribbonTabs` | [タブと表示モード](#tabs-and-display) を参照 | 表示するタブ。 |
| `ribbonDisplayMode` | `'full'` | `full`、`singleLine`、`tabsOnly`、`autoHide` のいずれか。 |
| `collapsed` | `false` | `ribbonDisplayMode` を省略したとき、`tabsOnly` を指定する簡略形です。 |
| `formulaBarVisible` | `true` | 表示タブにある数式バー切り替えの初期状態。 |
| `theme` | `'paper'` | リボン自身が持つ `paper`、`ink`、`contrast` の状態で、`onThemeChange` で通知されます。スプレッドシートのテーマは `instance.setTheme()` で変更します。 |
| `borderStyle`、`borderColor` | `'thin'`、`'#000000'` | 罫線メニューの線の種類と色の初期値。 |

### コマンドの接続

| 項目 | 意味 |
| --- | --- |
| `hooks` | ホストや機能のコードを呼ぶコマンド用の `RibbonHooks`。グループは `clipboard`、`sortFilter`、`insert`、`page`、`drawing`、`review`、`protection`、`automation`、`formula`、`sheetView` です。各グループは組み込みのグループに上書きでマージされるため、1 つの処理だけを差し替えて残りを維持できます。 |
| `dynamicDropdowns` | 組み込みのドロップダウンメニューを有効にします。`true` で既定の処理、部分的な `DynamicDropdownsCtx` で個別の処理の差し替え、その部分オブジェクトを返す関数でマウント後に用意するコンテキストを渡せます。 |
| `interceptCommand(id, button, event)` | コマンドの実行前に呼ばれます。`true` を返すと処理済みとみなされ、組み込みの実行を省略します。 |
| `commandDelegation` | `[data-ribbon-command]` のクリックをホストが自分で処理する場合は `false` にします。タブと表示オプションのクリックは常にリボンが処理します。 |
| `menus` | サブメニューを作る `RibbonMenus`。既定値に上書きでマージされます。 |
| `helpers` | 部分的な `RibbonRenderHelpers`。カラーピッカーなど、描画用のファクトリーを 1 つだけ差し替えます。 |
| `createBackstageView` | バックステージを開いている間に表示する要素を返します。 |

### 実行時のフック

`focusSheet`、`refreshCells`、`refreshZoom`、`showMessage`、`applyRibbonFormat` は、コマンドの前後で実行される処理を差し替えます。既定では、`focusSheet` はスプレッドシートのホストにフォーカスを移し、`applyRibbonFormat` は書式の変更をインスタンスの履歴に記録します。残りの 3 つは何もしません。`projectFormatToolbar` は、リボンがボタンの選択状態を更新した後に呼ばれます。その状態をほかの場所にも反映するホスト向けです。ほとんどのホストでは 6 つとも指定する必要はありません。

### コールバック

| コールバック | 呼ばれるタイミング |
| --- | --- |
| `onTabChange(tab)` | アクティブなタブが変わった後。 |
| `onCollapsedChange(collapsed)` | 展開と折りたたみの表示モードが切り替わった後。 |
| `onDisplayModeChange(mode)` | 表示モードが変わった後。 |
| `onBackstageOpenChange(open)` | `setBackstageOpen()` でバックステージの状態が変わった後。 |
| `onThemeChange(theme)` | リボンのテーマの状態が変わった後。 |
| `onFormulaBarChange(visible)` | 数式バーの切り替えが変わった後。 |
| `onCommand(id, applied)` | コマンドを実行した後。組み込みの処理が見つからなかった場合、`applied` は `false` です。ホスト独自のコマンド ID をここで処理できます。 |

ファイルタブを選ぶと、アクティブなタブが切り替わり `onTabChange('file')` が呼ばれるだけです。バックステージはホストがこのコールバックから自前で表示します。`toolbar.setBackstageOpen(true)` は `createBackstageView` が返す要素を表示し、戻るボタンまたは Escape で閉じて、直前のアクティブなタブに戻ります。それ以外のバックステージ内の操作はホストが処理します。ファイルメニューを持つホストでは、次のように両者をつなげます。

```ts
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  createBackstageView: () => buildFileMenu({ onClose: () => toolbar.setBackstageOpen(false) }),
  onTabChange: (tab) => {
    if (tab === 'file') toolbar.setBackstageOpen(true)
  },
})
```

`createBackstageView` を指定しない場合、開いたバックステージには空の要素が表示されます。

## ToolbarInstance {#toolbarinstance}

| メンバ | 用途 |
| --- | --- |
| `host` | リボンをマウントした要素。 |
| `instance` | 現在の `SpreadsheetInstance`。関数で渡したインスタンスがまだ `null` の間は `null` です。 |
| `applyCommand(id)` | リボンのコマンド ID を、クリックと同じ経路で実行します。処理が見つかれば `true` を返します。操作ポリシーで拒否されたコマンドも、実行されずに `true` を返します。 |
| `focusActiveTab()` | アクティブなタブのボタンにフォーカスを移します。F6 によるランドマーク間の移動に使います。フォーカスが移ったかどうかを返します。 |
| `setActiveTab(tab)`、`getActiveTab()` | アクティブなタブを変更・取得します。表示されていないタブは無視されます。 |
| `setDisplayMode(mode)`、`getDisplayMode()` | 表示モードを変更・取得します。 |
| `setCollapsed(collapsed)`、`getCollapsed()` | `tabsOnly` と `full` を切り替えます。`autoHide` のときも `getCollapsed()` は `true` です。 |
| `setBackstageOpen(open)`、`getBackstageOpen()` | バックステージの表示を切り替えます。 |
| `setDisplayMenuOpen(open)` | リボンの表示オプションメニューを開閉します。 |
| `setFormulaBarVisible(visible)`、`getFormulaBarVisible()` | 数式バー切り替えの状態を更新します。 |
| `setTheme(theme)`、`getTheme()` | リボンのテーマの状態を更新します。 |
| `setBorderStyle(style)`、`getBorderStyle()`、`setBorderColor(color)`、`getBorderColor()` | 罫線メニューの状態。 |
| `dropdownsApi` | `dynamicDropdowns` が有効な場合はドロップダウンのコントローラー、無効なら `null`。 |
| `rerender()` | リボンを作り直します。インスタンスを返す関数がインスタンスを返し始めたときに使います。選択や書式の変更は、これを呼ばなくても反映されます。 |
| `dispose()` | リスナーを外し、ホストの `lang` と `data-fc-platform` を元に戻して、ホスト要素を空にします。 |

ユーザーはアクティブなタブのダブルクリックや `Ctrl+F1` でも表示モードを切り替えられます。矢印キー、`Home`、`End` でタブ間を移動します。

## タブと表示モード {#tabs-and-display}

`RibbonTab` は `file`、`home`、`insert`、`draw`、`pageLayout`、`formulas`、`data`、`review`、`view`、`help`、`automate`、`acrobat` と、コンテキストタブの `chartDesign`、`chartFormat`、`shapeFormat`、`pictureFormat`、`tableDesign` のいずれかです。パッケージは次のタブ構成をエクスポートしています。

| 定数 | タブ |
| --- | --- |
| `EXCEL365_STANDARD_RIBBON_TABS` | ファイル、ホーム、挿入、ページレイアウト、数式、データ、校閲、表示、ヘルプ。 |
| `OPTIONAL_RIBBON_TABS` | 描画、自動化、Acrobat。 |
| `RIBBON_TABS` | 標準のタブに続けて任意のタブを並べたもの。 |
| `EXCEL365_MAC_RIBBON_TABS` | ホーム、挿入、描画、ページレイアウト、数式、データ、校閲、表示、自動化。 |
| `CHART_CONTEXTUAL_RIBBON_TABS` | グラフのデザイン、書式。 |
| `SHAPE_CONTEXTUAL_RIBBON_TABS` | 図形の書式。 |
| `PICTURE_CONTEXTUAL_RIBBON_TABS` | 図の書式。 |
| `TABLE_CONTEXTUAL_RIBBON_TABS` | テーブル デザイン。 |
| `CONTEXTUAL_RIBBON_TABS` | 上のコンテキストタブすべて。 |

`ribbonTabs` を省略すると、既定のプラットフォームでは `EXCEL365_STANDARD_RIBBON_TABS`、Mac では `EXCEL365_MAC_RIBBON_TABS` を表示します。React と Vue のコンポーネントも同じ既定値です。描画、自動化、Acrobat のタブを使うには、`RIBBON_TABS` または `[...EXCEL365_STANDARD_RIBBON_TABS, ...OPTIONAL_RIBBON_TABS]` を明示的に渡します。これらはホスト側で必要な処理を接続した場合だけ追加してください。`ribbonTabs` を明示すると Mac のタブ構成も置き換わります。タブは配列の順に並び、非表示や無効のタブはキーボード操作で飛ばされます。

`buildRibbonModel(lang, { tabs, profile, contextualTabs })` は、リボンが描画するものと同じモデルを返します。タブは `id` と `label`、グループは `title`、コマンドは `id`、`label`、`title` と、任意の `disabledReason` を持ちます。`profile` は `RibbonProfile` で、`default` か `excel365Mac` です。`contextualTabs` には `CHART_CONTEXTUAL_RIBBON_TABS` のようなコンテキストタブのリスト（[コンテキストタブ](#contextual-tabs) を参照）を渡し、モデルの末尾に追加します。ホスト側のコマンドパレットを作るときや、`applyCommand()` に渡すコマンド ID を調べるときに使います。

```ts
import { buildRibbonModel, type RibbonProfile } from '@libraz/formulon-cell'

const profile: RibbonProfile = 'excel365Mac'
const commands = buildRibbonModel('ja', { profile }).flatMap((tab) =>
  tab.groups.flatMap((group) => group.commands.map((command) => command.id)),
)
```

### コンテキストタブ {#contextual-tabs}

オブジェクトを選択している間、リボンは通常のタブの後ろにタブを追加します。どちらのプラットフォームでも、`ribbonTabs` の内容にかかわらず追加されます。オブジェクトを選択するとセルの選択が置き換わるため、タブは選択に追従します。

| 選択 | タブ | コマンド |
| --- | --- | --- |
| グラフ | グラフのデザイン、書式 | デザイン: グラフ要素を追加、色の変更、行/列の切り替え、データの選択、グラフの種類の変更。書式: 選択対象の書式設定と配置。 |
| 図形 | 図形の書式 | 図形の塗りつぶし、図形の枠線（色、太さ、実線/点線）、配置。 |
| 図 | 図の書式 | 配置。 |
| テーブル内のセル | テーブル デザイン | テーブル名、見出し行、集計行、縞模様（行）、最初の列、最後の列、縞模様（列）。 |

配置は、グラフ、図形、図のタブで共有する 1 つのグループです。前面へ移動、背面へ移動、オブジェクトの選択と表示は、選択中のオブジェクトに作用します。オブジェクトを挿入または貼り付けると、そのオブジェクトが選択されて最初のタブが開き、選択を外すと直前のタブへ戻ります。色のメニューにはワークブックテーマの色が表示されます。選択中のグラフの設定は、ホストから `instance.openChartSettings(tab?)` で開けます。`tab` は `'elements'`（既定）、`'styles'`、`'filters'` で、グラフが選択されていなければ `false` を返します。

## ドロップダウンの処理 {#dropdown-handlers}

貼り付け、フィル、クリア、並べ替えとフィルター、保護などのドロップダウンメニューは、`DynamicDropdownsCtx` の処理を実行します。個別に差し替えるには部分的なオブジェクトを渡します。`mountToolbar()` とインラインの `toolbar` オプションでは `dynamicDropdowns`、フレームワークのコンポーネントでは `dropdownActions` です。渡さなかったキーは組み込みの処理のまま残ります。既定のコンテキスト全体は `createDefaultDynamicDropdownsCtx()` で取得できます。

```ts
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  dynamicDropdowns: {
    // 'protect-sheet'、'unprotect-sheet'、'protect-workbook'、'unprotect-workbook'、'allow-edit-ranges'
    applyProtectAction: (action) => openProtectDialog(action),
  },
})
```

処理の名前はメニューに対応しています。`applyCopyAction`、`applyRibbonPasteAction`、`applyFillSeries`、`applyClearAction`、`applySortMenuAction`、`applyProtectAction`、`applyCalcOptionAction`、`applyScriptAction`、`insertPictureFromRibbon`、`createTableFromSelection` などがあり、全体は `DynamicDropdownsCtx` の型宣言で確認できます。

操作ポリシーがある間、インラインのリボンではドロップダウンが無効になります。マウント済みのリボンでは、ポリシーで拒否されるコマンドも無効になります。[オプション](/ja/cell/options#operation-policy) を参照してください。

## ホスト側のコールバック {#host-callbacks}

フレームワークのコンポーネントは、一部のリボンボタンをプロパティへ接続します。

| プロパティ | リボンのコマンド | コアのフック |
| --- | --- | --- |
| `onSpellingReview` | 校閲 → スペル チェック | `hooks.review.spelling` |
| `onAccessibilityCheck` | 校閲 → アクセシビリティ チェック | `hooks.review.accessibility` |
| `onTranslate` | 校閲 → 翻訳 | `hooks.review.translate` |
| `onDrawPen`、`onDrawEraser` | 既定のプラットフォームの描画 → ペン、消しゴム | `hooks.drawing.setInkMode()` に `'pen'` または `'erase'` |
| `onRunScript` | 自動化タブのスクリプトメニューにあるカスタムスクリプトの項目 | `applyScriptAction('custom')` |
| `onAddIn` | アドインメニューの管理 | `applyAddInAction('manage')` |

プロパティを渡すと、対応するコアのフックが置き換わります。プロパティを省略した場合、スペル チェック、翻訳、アクセシビリティ チェックは選択したセルについてのレポートを表示する組み込みの処理のままで、スクリプトとアドインの項目もコアのスクリプト・アドインの処理のままです。フレームワークを使わない `mountToolbar()` で校閲の処理を置き換えるには `hooks.review` を渡します。`onRunScript` や `onAddIn` を渡した場合も、置き換わるのはそれぞれの項目だけです。スクリプトとアドインのボタンは先にメニューを開き、ユーザーが対応する項目を選ぶとコールバックが呼ばれます。`dropdownActions` に `applyScriptAction` や `applyAddInAction` を指定した場合は、そちらが優先されます。

## プラットフォームによる違い {#platform-differences}

Mac のプラットフォームでは `EXCEL365_MAC_RIBBON_TABS` を使います。ファイルタブとヘルプタブがなく、描画と自動化のタブがあります。ホームタブはデスクトップの Mac 版と同じ配置で、切り取り、コピー、書式のコピー/貼り付けはアイコンとテキストの行、挿入、削除、書式は大きなタイルです。どちらのホームタブも、フォントグループに「ふりがなの設定」があります。Mac のコマンド ID は `mac.` で始まります。たとえば `mac.data.goalSeek`、`mac.insert.sparkline`、`mac.review.stats`、`mac.formulas.insertFunction` です。`applyCommand()` はほかの ID と同じように実行し、その多くは既定のプラットフォームの対応するコマンドを内部で使います。

```ts
instance.toolbar?.applyCommand('mac.data.goalSeek')
```

Mac の描画タブは、インクをマウント中のセッションに保持します。`drawing` フックと `onDrawPen` / `onDrawEraser` が対象とするのは、既定のプラットフォームの描画タブです。Mac のダイアログ、そのコマンド ID と上限は [プラットフォームと Mac UI](/ja/cell/platform#mac-ribbon-dialogs) にまとめています。

## スタイル {#styling}

`@libraz/formulon-cell/styles.css` はグリッドやテーマと一緒にリボンのスタイルシートも読み込むため、ほとんどのアプリケーションでは追加の読み込みは不要です。`@libraz/formulon-cell/styles/toolbar.css` はリボンのスタイルシートだけを含みます。アダプターの `@libraz/formulon-cell-react/toolbar.css` と `@libraz/formulon-cell-vue/toolbar.css` は、このファイルを再エクスポートしたもので、パッケージごとにスタイルシートを並べるアプリケーション向けです。

リボンは専用の `--fc-tb-*` トークンを使います。インラインのリボンを含め、`.fc-host` の中では `--fc-tb-accent` と `--fc-tb-accent-strong` がグリッドの `--fc-accent` と `--fc-accent-strong` に追従します。ブランドカラーを 1 か所で上書きすれば両方に反映されます。独立したツールバーはツールバーの既定値を使うため、ラッパーにトークンを設定します。

```css
.app-toolbar {
  --fc-tb-accent: #0f766e;
  --fc-tb-accent-strong: #115e59;
  --fc-tb-ribbon-bg: #ffffff;
  --fc-tb-ribbon-hover: #f0fdfa;
}
```

`ink` と `contrast` のテーマは、`data-fc-theme` を通じて独自の `--fc-tb-*` の値を持っています。グリッドのトークンは [テーマ](/ja/cell/theming) を参照してください。

## 関連ページ

- [オプション](/ja/cell/options) — リボンが表示される条件と、ポリシーによる制限。
- [プラットフォームと Mac UI](/ja/cell/platform) — Mac のリボン、ダイアログ、上限。
- [React / Vue アダプター](/ja/cell/frameworks) — `Spreadsheet` コンポーネントのプロパティ。
- [埋め込み](/ja/cell/embedding) — リボンを使わずにホスト側でコントロールを持つ方法。
- [テーマ](/ja/cell/theming) — テーマとグリッドのトークン。
