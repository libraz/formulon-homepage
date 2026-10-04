---
title: フックとコンポーザブル
description: formulon-cell の選択範囲、状態、イベント、ラベルを React / Vue の UI へ接続します。
---

# フックとコンポーザブル

React / Vue のアダプターには、スプレッドシートの周辺 UI で使える同じ 4 種類の購読手段があります。

<div class="wide-table cell-hook-table">

| 用途 | React | Vue |
| --- | --- | --- |
| アクティブセルや範囲を表示する | `useSelection(instance)` | `useSelection(instanceRef)` |
| ホストパネル用の値を導出する | `useSpreadsheet(instance, selector, fallback)` | `useSpreadsheet(instanceRef, selector, fallback)` |
| 現在のロケールとラベルを使う | `useI18n(instance)` | `useI18n(instanceRef)` |
| 名前付きのスプレッドシートイベントに反応する | `useSpreadsheetEvent(instance, event, handler)` | `useSpreadsheetEvent(instanceRef, event, handler)` |

</div>

これらのフックは、アダプターがマウントしたインスタンスを購読します。React では準備前に `null` を渡します。Vue では `shallowRef<SpreadsheetInstance | null>(null)` を作り、準備後に同じ参照へインスタンスを設定します。インスタンスが準備できるまではフォールバック値を返し、差し替わると購読先も切り替えます。

フックは状態とイベントを購読します。スプレッドシートの所有権を持たず、`dispose()` も呼びません。`<Spreadsheet>` アダプターはコンポーネントがツリーから外れるとインスタンスを破棄します。`Spreadsheet.mount()` を直接呼ぶホストでは、ビューの終了時にホストがインスタンスを破棄します。

<CellEmbedDemo scenario="host-sync" />

## React: 選択範囲インスペクターと編集状態

次の例では、スプレッドシートとホスト側のインスペクターを同じコンポーネントに配置します。4 種類のフックをすべて使います。

- `useSelection` でアクティブセルと主選択範囲を取得します。
- `useSpreadsheet` で、その範囲に含まれるセル数を導出します。
- `useI18n` で、インスペクターに表示するロケールとステータスバーのラベルを取得します。
- `useSpreadsheetEvent` で、適用済みの `changeBatch` 後にインスペクターを更新します。

```tsx
import { useState } from 'react'
import {
  Spreadsheet,
  useI18n,
  useSelection,
  useSpreadsheet,
  useSpreadsheetEvent,
  type SpreadsheetInstance,
} from '@libraz/formulon-cell-react'
import '@libraz/formulon-cell/styles.css'

export function SheetWithInspector() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)
  const [lastEdit, setLastEdit] = useState<string | null>(null)
  const [mountError, setMountError] = useState<string | null>(null)

  // フックはレンダー分岐より前で常に呼び出します。instance が null の間も動作します。
  const selection = useSelection(instance)
  const selectedCellCount = useSpreadsheet(
    instance,
    (state) => {
      const range = state.selection.range
      return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)
    },
    1,
  )
  const { locale, strings } = useI18n(instance)
  useSpreadsheetEvent(instance, 'changeBatch', (result) => {
    if (result.status !== 'applied') return
    const label = strings?.statusBar.cells ?? 'セル'
    setLastEdit(`${result.applied.length} ${label} · revision ${result.revision}`)
  })

  const readyLabel = strings?.statusBar.ready ?? 'スプレッドシートを読み込んでいます…'
  const activeCell = `${selection.active.row + 1}:${selection.active.col + 1}`

  return (
    <section className="sheet-layout">
      <div className="sheet-host">
        <Spreadsheet
          ui={{ profile: 'embedded', features: { shortcuts: true, clipboard: true } }}
          toolbar={false}
          locale="ja"
          onReady={setInstance}
          onError={(error) => setMountError(error instanceof Error ? error.message : String(error))}
          style={{ width: '100%', height: 420 }}
        />
      </div>
      <aside className="sheet-inspector" aria-live="polite">
        {instance && strings ? (
          <>
            <strong>{readyLabel}</strong>
            <label>
              言語
              <select value={locale} onChange={(event) => instance.i18n.setLocale(event.target.value)}>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <span>アクティブセル: {activeCell}</span>
            <span>主選択範囲: {selectedCellCount} セル</span>
            <span>{lastEdit ?? '適用済みの編集はありません'}</span>
          </>
        ) : !mountError ? (
          <span>スプレッドシートを読み込んでいます…</span>
        ) : null}
        {mountError && <span role="alert">{mountError}</span>}
      </aside>
    </section>
  )
}
```

スプレッドシートのホストには高さを指定します。インポートしたコアのスタイルシートがグリッドの表示を担当し、ホスト側のレイアウトがアダプターの描画領域を確保します。

```css
.sheet-layout {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.sheet-host {
  min-height: 320px;
  height: 420px;
}

.sheet-inspector {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
```

`onReady` が呼ばれる前もフックを常に呼び出します。インスタンスの準備後にインスペクターだけを切り替え、`<Spreadsheet>` 要素はマウントしたままにします。

上のセル数は `selection.range` にある主選択範囲の値です。非連続選択で全範囲の合計が必要な場合は、`selection.extraRanges` も明示的に加算します。`Ctrl` または `Cmd` を押しながらドラッグすると別の範囲を追加できます。`Ctrl+Enter` / `Cmd+Enter` は現在の編集内容を選択したすべての範囲へ書き込みます。リボンの書式設定とクリアもすべての範囲を処理し、各範囲を現在のポリシーで認可します。`selectionChange` イベントが返すのはアクティブセル、アンカー、主選択範囲だけで、`extraRanges` はアダプターのフックとストアの状態から取得します。

## Vue: 同じインスペクターを SFC で作る

Vue のコンポーザブルにはインスタンスの ref 自体を渡します。`instance.value` ではなく `instance` をすべてのコンポーザブルに渡してください。コンポーザブルが ref を監視し、アダプターの準備後やインスタンスの差し替え時に購読を更新します。

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watchEffect } from 'vue'
import {
  Spreadsheet,
  useI18n,
  useSelection,
  useSpreadsheet,
  useSpreadsheetEvent,
  type SpreadsheetInstance,
} from '@libraz/formulon-cell-vue'
import '@libraz/formulon-cell/styles.css'

const instance = shallowRef<SpreadsheetInstance | null>(null)
const lastEdit = ref<string | null>(null)
const rejection = ref<string | null>(null)
const mountError = ref<string | null>(null)

const selection = useSelection(instance)
const selectedCellCount = useSpreadsheet(
  instance,
  (state) => {
    const range = state.selection.range
    return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)
  },
  1,
)
const { locale, strings } = useI18n(instance)
useSpreadsheetEvent(instance, 'changeBatch', (result) => {
  if (result.status !== 'applied') return
  const label = strings.value.statusBar?.cells ?? 'セル'
  lastEdit.value = `${result.applied.length} ${label} · revision ${result.revision}`
})

// 拒否結果はコマンドの結果です。適用済みバッチのイベントとは別に購読します。
watchEffect((onCleanup) => {
  const current = instance.value
  rejection.value = null
  if (!current) return
  const off = current.commands.subscribe((result) => {
    if (result.status !== 'rejected') {
      if (result.status === 'applied') rejection.value = null
      return
    }
    const first = result.rejected[0]
    rejection.value = first
      ? `${first.code}${first.reason ? `: ${first.reason}` : ''}`
      : '編集が拒否されました'
  })
  onCleanup(off)
})

const onReady = (next: SpreadsheetInstance) => {
  instance.value = next
}
const onError = (error: unknown) => {
  mountError.value = error instanceof Error ? error.message : String(error)
}
const changeLocale = (event: Event) => {
  instance.value?.i18n.setLocale((event.target as HTMLSelectElement).value)
}
const readyLabel = computed(() => strings.value.statusBar?.ready ?? 'スプレッドシートを読み込んでいます…')

// ビューを削除するときに、所有側の参照も消します。インスタンスの破棄はアダプターが行います。
onBeforeUnmount(() => {
  instance.value = null
})
</script>

<template>
  <section class="sheet-layout">
    <div class="sheet-host">
      <Spreadsheet
        :ui="{ profile: 'embedded', features: { shortcuts: true, clipboard: true } }"
        :toolbar="false"
        locale="ja"
        style="width: 100%; height: 420px"
        @ready="onReady"
        @error="onError"
      />
    </div>
    <aside class="sheet-inspector" aria-live="polite">
      <template v-if="instance">
        <strong>{{ readyLabel }}</strong>
        <label>
          言語
          <select :value="locale" @change="changeLocale">
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
        <span>アクティブセル: {{ selection.active.row + 1 }}:{{ selection.active.col + 1 }}</span>
        <span>主選択範囲: {{ selectedCellCount }} セル</span>
        <span>{{ lastEdit ?? '適用済みの編集はありません' }}</span>
        <span v-if="rejection" role="alert">{{ rejection }}</span>
      </template>
      <span v-else-if="!mountError">スプレッドシートを読み込んでいます…</span>
      <span v-if="mountError" role="alert">{{ mountError }}</span>
    </aside>
  </section>
</template>

<style scoped>
.sheet-layout {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.sheet-host {
  min-height: 320px;
  height: 420px;
}

.sheet-inspector {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
```

Vue のテンプレートでは、`@change-batch` や `@selection-change` のように、単語をハイフンでつないだケバブケースでコンポーネントイベントを記述します。`useSpreadsheetEvent` に渡すイベント名は、`changeBatch` や `selectionChange` のようなインスタンス API の型付き名称です。

## ユースケース: 拒否された編集を表示する

`useSpreadsheetEvent(instance, 'changeBatch', handler)` は、適用済みバッチに連動するインジケータに適しています。ポリシーで拒否された編集は適用済みバッチになりません。拒否理由を表示したり、`rejected`、`noop`、`applied` を区別したりする場合は `instance.commands` を購読します。

React では `useEffect()` で現在のインスタンスへの購読を管理します。

```tsx
import { useEffect, useState } from 'react'
import type { SpreadsheetInstance } from '@libraz/formulon-cell-react'

export function RejectionNotice({ instance }: { instance: SpreadsheetInstance | null }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setMessage(null)
    if (!instance) return
    return instance.commands.subscribe((result) => {
      if (result.status !== 'rejected') {
        if (result.status === 'applied') setMessage(null)
        return
      }
      const first = result.rejected[0]
      setMessage(first ? `${first.code}: ${first.reason ?? '編集が拒否されました'}` : '編集が拒否されました')
    })
  }, [instance])

  return message ? <p role="alert">{message}</p> : null
}
```

Vue では、上の SFC と同じように `watchEffect` と `onCleanup` を使います。ホスト側でコマンドを発行する場合は、`instance.commands.execute(command)` が返す `ChangeBatchResult` の `status` と `rejected` を確認します。

## ユースケース: ホスト側のコントロールをローカライズする

ホスト側のパネルを `instance.i18n.setLocale()` やラベル拡張に追従させる場合は `useI18n` を使います。返される辞書はスプレッドシート UI と同じものなので、ホスト側で別のロケール購読を管理する必要がありません。

```tsx
const { locale, strings } = useI18n(instance)

return (
  <label>
    {locale === 'ja' ? '言語' : 'Language'}
    <select
      disabled={!instance}
      value={locale}
      onChange={(event) => instance?.i18n.setLocale(event.target.value)}
    >
      <option value="en">English</option>
      <option value="ja">日本語</option>
    </select>
    <span>{strings?.statusBar.ready}</span>
  </label>
)
```

React では `strings` が `null` の間にフォールバックを使います。Vue では、インスタンスが準備されるまで空のフォールバック辞書が返るため、テンプレートまたは算出プロパティで `strings.value.statusBar?.ready` のように未定義のラベルを参照しないよう確認します。

## ユースケース: スプレッドシートの状態からホスト表示を導出する

パネルに小さな導出値だけが必要な場合は `useSpreadsheet` を使います。セレクタはストアが更新されるたびに再実行され、インスタンスがない間はフォールバック値を返します。

```tsx
const activeSheet = useSpreadsheet(instance, (state) => state.data.sheetIndex, 0)
const primaryRange = useSpreadsheet(instance, (state) => state.selection.range, {
  sheet: 0,
  r0: 0,
  c0: 0,
  r1: 0,
  c1: 0,
})
```

パネルが表示する値だけをセレクタで選びます。数式の値やワークブック操作は `SpreadsheetInstance` に任せ、フックはリアクティブな表示値に使います。

## どの購読方法を使うか

用途に合う範囲の API を選びます。

- コンポーネントを現在のスプレッドシート状態から再描画する場合は、`useSelection`、`useSpreadsheet`、`useI18n` を使います。
- 適用済み編集の件数や再計算通知のように、名前付きイベントに応じて処理する場合は `useSpreadsheetEvent` を使います。
- マウント時の小さな処理には `onReady`、`onError`、アダプターのイベントプロパティを使います。Vue テンプレートではイベント名をケバブケースで記述します。
- React / Vue のコンポーネント外にあるサービスやホストコントローラでは `instance.on(event, handler)` を使います。返された解除関数をサービスの終了時に呼びます。

同じイベントをフックとアダプターのプロパティの両方で購読する場合は、2 つの独立した利用者が必要か確認します。フックはコンポーネントの終了時、またはインスタンスの差し替え時に自分の購読を解除します。インスタンスの破棄は所有側が行います。

コンポーネント外で購読する場合は、監視を終了するときに解除関数を呼びます。

```ts
const offSelection = instance.on('selectionChange', (event) => {
  console.log('selection changed', event.range)
})

function stopWatching() {
  offSelection()
}
```

ビューがスプレッドシートのインスタンスを差し替える場合は、所有側の参照も同時に更新します。React のフックは新しいオブジェクトを購読し、Vue のコンポーザブルは ref を監視して古い購読を解除してから新しい購読を開始します。

フックが解除するのは購読だけです。インスタンスの破棄はマウントした所有側で行い、呼び出し元から渡したワークブックの管理もその所有側で判断します。[埋め込みガイド](./embedding) のライフサイクルも参照してください。

関連: [React / Vue アダプター](./frameworks)、[ホスト統合](./host-integration)、[国際化](./i18n)。
