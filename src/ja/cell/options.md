---
title: formulon-cell のオプション
description: 表示 UI、編集セル、ナビゲーション範囲、メニュー、オーバーレイの配置を設定します。
---

# オプション

`Spreadsheet.mount(host, options)` では、UI プロファイル、操作権限、ナビゲーション、コンテキストメニュー、浮動 UI を個別に設定できます。まずプロファイルを選び、必要な制限やホスト連携だけを追加します。

## UI プロファイルと機能スイッチ {#ui-profile-and-feature-switches}

`ui.profile` は UI の初期構成を選びます。

| プロファイル | 初期構成 |
| --- | --- |
| `embedded` | 組み込み機能をすべて無効にし、リボンと印刷も出しません。必要な機能だけを `ui.features` で有効にします。 |
| `minimal` | `presets.minimal()` と同じです。数式バー、ステータスバー、クリップボード、キーボードショートカット、ホイールスクロールを使えます。 |
| `standard` | `presets.standard()` と同じです。シート見出し、コンテキストメニュー、検索と置換、書式のコピー、クイック分析、グラフ、入力候補を加えます。書式設定などの作成系ダイアログは含みません。 |
| `excel365` | 下記のオプトイン機能を除くすべての機能です。`ui.profile` を省略した場合もこの構成になります。 |
| `full` | `excel365` と同じ機能構成です。 |

`ui.platform` は `ui.profile` とは独立して解決されます。既定の UI には `default`、Mac の UI を明示的に選ぶ場合は `mac`、ブラウザーから判定する場合は `auto` を使います。iPad と iPhone のユーザーエージェント、およびタッチ対応の `MacIntel` は `default` に解決されます。Mac リボンと制限は [プラットフォームと Mac UI](/ja/cell/platform) を参照してください。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'standard',
    theme: 'ink',
    features: {
      ribbon: true,
      sheetTabs: true,
      statusBar: false,
      comments: false,
      charts: false
    }
  }
})
```

`ui.features` には、読みやすい名前のオン・オフのスイッチを指定します。多くは下位の機能フラグと同じ名前ですが、名前が異なるものや UI 側にしかないものもあります。

| `ui.features` のスイッチ | 機能フラグ |
| --- | --- |
| `formulaBar`、`viewToolbar`、`sheetTabs`、`statusBar`、`localeSwitcher`、`workbookObjects`、`contextMenu`、`findReplace`、`formatDialog`、`formatPainter`、`namedRanges`、`hyperlink`、`pasteSpecial`、`quickAnalysis`、`charts`、`pageSetup`、`validation`、`autocomplete`、`clipboard`、`shortcuts`、`wheel`、`watchWindow`、`slicer` | 同じ名前です。 |
| `conditionalFormatting` | `conditional` |
| `comments` | `commentDialog` |
| `pivotTable` | `pivotTableDialog` |
| `ribbon` | 対応するフラグはありません。リボンを表示します。`embedded` 以外では既定で有効です。 |
| `print` | 対応するフラグはありません。`instance.print()` を有効にします。`embedded` 以外では既定で有効です。`print: false` にすると、`pageSetup` を明示しない限りページ設定も無効になります。 |

`borderDraw`、`iterative`、`fxDialog`、`illustrations`、`hoverComment`、`errorIndicators`、`gotoSpecial` にはスイッチがないため、`ui.advancedFeatures` かトップレベルの `features` で指定します。指定しなかったフラグは有効です。ただし `watchWindow`、`slicer`、`viewToolbar`、`localeSwitcher` の 4 つはオプトインで、どのプロファイルでも初期状態は無効です。

`localeSwitcher` は、数式バーの下に組み込みの言語セレクターを追加します。多くのホストは独自の言語メニューを持つため、オプトインにしています。詳しくは [言語を切り替える](/ja/cell/language-switching) を参照してください。`validation` はセルの入力補助とリストのドロップダウンを制御します。一方、`openDataValidationDialog()` はセルの書式設定ダイアログの 1 ページを開くため、`formatDialog` が必要です。

初回マウント時の解決順序は次のとおりです。

1. 選択した `ui.profile` が初期の機能構成を決めます。
2. `ui.advancedFeatures` が機能フラグを直接変更します。
3. `ui.features` が利用者向けのスイッチを変更します。
4. トップレベルの `features` が、ここまでのすべてより優先されます。

トップレベルの `theme` は `ui.theme` より優先されます（既定は `paper`、組み込みテーマは `paper`、`ink`、`contrast`）。トップレベルの `toolbar` はプロファイルのリボン設定より優先されます。そのため、同じプロファイルを共有しながら、ホストごとにツールバーの置き場所を決められます。

::: info リボンが表示される条件
リボンが表示されるのは、`toolbar` に `true` かオプションオブジェクトを渡した場合と、リボンを含むプロファイルの `ui` を渡した場合だけです。`ui` も `toolbar` も指定しないマウントでは、機能構成が `excel365` になってもリボンは表示されません。機能フラグは組み込み機能を選ぶだけで、リボンをマウントしません。
:::

`setUi()` は現在のワークブックを保ったまま、プロファイル、プラットフォーム、テーマを再解決します。省略した項目は既定値に戻るため、UI 設定はすべて渡してください。初回マウント時のトップレベルの `features`、`theme`、`toolbar` も再適用されます。プラットフォームを変更すると、開いている Mac の数式パレットを閉じ、保留中の下書きを破棄します。これらの値を個別に変更する場合は `setFeatures()`、`setTheme()`、`setToolbar()` を使います。

<CellEmbedDemo scenario="profiles" />

## プリセットと拡張

`presets.minimal()`、`presets.standard()`、`presets.full()` は `FeatureFlags` オブジェクトを返します。トップレベルの `features` に渡します。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: {
    ...presets.standard(),
    findReplace: false,
    formatDialog: true
  }
})
```

`extensions` には、`findReplace()` などのファクトリが返す拡張オブジェクトを渡します。組み込み機能の置き換えや追加の UI に使います。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace()]
})
```

`features` は組み込み機能の有効化と無効化、`extensions` は拡張オブジェクトのマウントを担当します。2 つを別の設定として扱います。ファクトリーの一覧と置き換えの手順は [拡張](/ja/cell/extensions) を参照してください。

## 操作ポリシー {#operation-policy}

`policy` はグリッド、キーボード、クリップボード、コンテキストメニュー、組み込みツールバーから利用者が実行できる操作を制御します。表示 UI のプロファイルとは独立しています。元に戻す・やり直しの操作も、その時点のポリシーで再確認されます。

選択とコピーができるビューアーには `viewerPolicy()` を使います。変更を伴う操作はすべて拒否し、印刷とエクスポートはホストが明示的に許可するまで拒否します。次の例ではエクスポートを許可しています。

```ts
const policy = {
  ...viewerPolicy(),
  operations: {
    export: true
  }
}
```

入力セルを宣言するフォームには `fixedFormPolicy()` を使います。

```ts
const policy = fixedFormPolicy([
  { sheet: 0, r0: 3, c0: 1, r1: 12, c1: 2 }
])
```

ポリシーヘルパーには範囲の配列、判定関数、`{ ranges }` / `{ predicate }` を渡せます。判定関数には `{ addr, operation, origin }` が渡されます。

```ts
const policy = fixedFormPolicy(({ addr, operation }) =>
  addr.sheet === 0 &&
  addr.col === 2 &&
  addr.row >= 3 &&
  addr.row <= 12 &&
  operation === 'valueEdit'
)
```

独自ポリシーは `InteractionPolicy` 型のオブジェクトです。ポリシーを指定すると、許可していない操作はすべて拒否されます。

| フィールド | 意味 |
| --- | --- |
| `operations` | 操作ごとの `true` / `false`。 |
| `defaultOperation` | `operations` に書いていない操作の扱い。`'deny'`（既定）または `'allow'`。 |
| `readOnly` | `operations` の指定にかかわらず、変更を伴う操作をすべて拒否します。 |
| `editable` | 変更できるセル。範囲の配列、判定関数、`{ ranges }` / `{ predicate }` のいずれか。省略するとすべてのセルが対象です。 |
| `selection`、`copy` | セルの選択とコピーを許可するかどうか。 |
| `batchDenied` | `'reject'` は貼り付けやフィルで 1 セルでも拒否されると全体を失敗にします。`'skipIneligible'` は許可されたセルだけに書き込みます。 |
| `restrict` | 最後に実行される同期の確認関数。要求を拒否できますが、ポリシーが拒否した操作を許可することはできません。 |

操作名は `valueEdit`、`formulaEdit`、`clear`、`paste`、`fill`、`moveCells`、`format`、`insertRows`、`deleteRows`、`insertColumns`、`deleteColumns`、`resizeRows`、`resizeColumns`、`sort`、`merge`、`filter`、`table`、`comment`、`hyperlink`、`validation`、`namedRange`、`sheet`、`object`、`protection`、`pageSetup`、`print`、`export` です。ビューを編集可能から読み取り専用へ切り替える場合は `instance.setPolicy()` を使います。ある操作が許可されるかを事前に確かめるには `instance.commands.canExecute()` を使います。

保護と結合セルも認可の対象です。結合範囲に触れる書き込みは結合全体を確認し、アンカーセルに適用します。複数範囲の書式設定やクリアを含む複合操作は、実行時に加えて元に戻す・やり直し時にも再認可されます。そのため、ポリシーを変更した後の再実行が拒否されることがあります。

::: warning ポリシーは組み込み UI も制限します
ポリシーが有効な間、使える組み込み機能は数式バー、クリップボード、キーボードショートカット、ホイールスクロール、コンテキストメニューだけです。ダイアログ、パネル、言語セレクターは、機能フラグを有効にしても表示されません。操作を許可しても、その UI は戻りません。マウント済みのリボンは表示されたままですが、ポリシーが拒否するコマンドは無効になります。それ以外の操作はホスト側のコントロールで用意し、ホストのコードから低レベルのヘルパーを呼ぶ場合は自分で認可してください。
:::

<CellEmbedDemo scenario="form" />

## ビューポートとキーボードナビゲーション

`viewport.range` は表示・移動できるセル範囲を制限します。ワークブックのデータ自体は削除しません。座標は 0 始まりで、両端を含みます。

```ts
const viewport = {
  range: { sheet: 0, r0: 0, c0: 0, r1: 30, c1: 6 },
  tabNavigation: 'editable' as const,
  tabBoundary: 'stop' as const
}
```

その他のオプションは次のとおりです。

- `selectable`: 選択可能なセルをさらに絞る範囲の配列、または判定関数です。
- `tabNavigation`: `normal` はグリッドの順序、`editable` は現在のポリシーで編集できるセルの順序です。
- `tabBoundary`: `stop` は設定範囲内でフォーカスを止め、`leave` は Tab で範囲の外へ移動します。
- `autoExpand`: シートに合わせてナビゲーション範囲を広げます。固定の `range` と同時に指定すると例外が発生します。

マウント後にレポート範囲やフォームのページを切り替える場合は `instance.setViewportOptions()` を使います。固定範囲は一度に 1 枚のシートを対象とするため、シートを変えるときは範囲のシート番号も変更します。

## コンテキストメニュー

次の 3 モードから選択します。

```ts
import type { ContextMenuOptions } from '@libraz/formulon-cell'

const noMenu: ContextMenuOptions = { mode: 'disabled' }

const builtInMenu: ContextMenuOptions = {
  mode: 'builtIn',
  items: ['copy', 'cut'],
  transform: ({ defaultItems }) => defaultItems
}

const hostMenu: ContextMenuOptions = {
  mode: 'host',
  onOpen: ({ cell, selection, canExecute }) => {
    openApplicationMenu({ cell, selection, canCopy: canExecute('copy').allowed })
  }
}
```

`builtIn` はパッケージのメニューを残し、項目を絞り込んだり、現在の項目一覧を変換したりできます。`host` はパッケージとブラウザのメニューを抑止し、現在のセル、選択範囲、権限の問い合わせ関数（`canExecute`、別名 `permission`）をホストへ渡します。`disabled` は右クリックメニューを表示しません。

`transform` が返す項目には `id` が必要で、`label`、`hint`、`separator`、`children`、`disabled`、`disabledReason` を任意で指定できます。ホストのダイアログを開いたりアプリケーションのイベントを送ったりするには `action` コールバックを、現在のポリシーを通してセルを一括変更するには `command` を指定します。`items` オプションには組み込み項目の ID が型として定義されているため、エディターで補完できます。独自の ID には `host:details` のような接頭辞を付け、組み込み項目と区別してください。

## オーバーレイの配置

浮動メニュー、ツールチップ、組み込みダイアログはオーバーレイポータルに配置されます。ホストのモーダルや全画面表示要素が表示境界を所有する場合は `overlays.root` を指定します。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  overlays: { root: modalSurface }
})
```

`root` には配置先を返す関数も指定できます。

```ts
instance.setOverlayOptions({
  root: () => document.querySelector<HTMLElement>('.modal-surface')!
})
```

`root` はマウント先と同じドキュメントの `HTMLElement` である必要があります。ネイティブ `<dialog>` と全画面表示の例は [モーダルとダイアログ](/ja/cell/modals) を参照してください。

## マウント後に設定を変更する {#runtime-changes}

次のメソッドで、ワークブックを置き換えずに組み込み設定を更新できます。

```ts
instance.setUi(nextUi)
instance.setFeatures(nextFeatures)
instance.setExtensions(nextExtensions)
instance.setPolicy(nextPolicy)
instance.setViewportOptions(nextViewport)
instance.setContextMenu(nextContextMenu)
instance.setOverlayOptions(nextOverlays)
instance.setToolbar(nextToolbar)
instance.setTheme(nextTheme)
instance.setLocale(nextLocale) // 切り戻した場合は false を返します
```

React と Vue のアダプターは、プロパティが変わると対応するメソッドを呼びます。

## その他のマウントオプション

| オプション | 用途 | 詳細 |
| --- | --- | --- |
| `workbook` | ホストが作成・読み込みしたワークブックをマウントします。省略すると既定のワークブックを作成します。 | [インストール](/ja/cell/install#host-sizing) |
| `locale`、`strings` | UI の言語（既定は `ja`）とラベルの上書き。 | [国際化](/ja/cell/i18n) |
| `toolbar` | `true` またはリボンのオプションを渡すと、ホスト内にリボンをマウントします。 | [リボンツールバー](/ja/cell/toolbar) |
| `functions` | 数式の入力候補に表示し、`instance.formula` から呼び出せるホスト関数。 | [セルの独自表示とホスト関数](/ja/cell/custom-cells#host-functions) |
| `seed` | マウント時に作成したワークブックへ、最初の描画前に値を入れるコールバック。主にデモ用です。 | [セルの独自表示とホスト関数](/ja/cell/custom-cells#host-functions) |
| `onError`、`renderError` | マウント失敗時のコールバック。`renderError: false` で組み込みのエラーパネルを表示しません。 | [インストール](/ja/cell/install) |
| `getWorkbookName`、`uploadStatus`、`macroRecording` | Watch Window の表示名とステータスバーの表示。 | [ホスト統合](/ja/cell/host-integration#status-bar) |
| `printerProfiles`、`printerProfileId`、`refreshPrinterProfiles` | 印刷と PDF 出力で使う印刷可能領域。 | [ホスト統合](/ja/cell/host-integration#printer-profiles) |
| `captureScreenClip` | ネイティブアプリでの［挿入］→［スクリーンショット］→［画面の領域］。 | [ホスト統合](/ja/cell/host-integration#native-screen-capture) |
| `getFunctionArgumentHelp` | Mac の数式パレットに表示する引数ごとのヘルプ。 | [プラットフォームと Mac UI](/ja/cell/platform#function-arguments-palette) |

すべての項目は、パッケージの型宣言にある `MountOptions` 型を参照してください。
