# ワークブックの流れ

ほとんどの組み込みは同じ流れです。ワークブックのバイト列を読み込み、編集と再計算を行い、結果の値を取得するかファイルに保存します。どこで何が起きるかを把握すると、計算・入出力・UI・永続化の責務を分けやすくなります。

<DiagramFlow :steps="[
  { label: 'ワークブックのバイト列を開く', note: 'XLSX / XLSB は内容から判別' },
  { label: 'ワークブックモデルにパース', note: 'シート・セル・スタイル・名前' },
  { label: '編集を適用', note: '値・数式・構造を変更' },
  { label: '依存関係グラフを更新', note: '順方向・逆方向の辺' },
  { label: '再計算', note: '再計算待ちのセルを評価' },
  { label: '読む / 保存', note: 'キャッシュ値、またはバイト列' }
]" label="ワークブックのライフサイクル: バイト列を開き、モデルにパースし、編集を適用し、依存関係グラフを更新して再計算し、値を読むかバイト列を保存する" caption="編集はセルを再計算待ちにするだけで、ホストが再計算するまで値は最新になりません。" />

::: info 用語: ワークブックモデル
パース後のワークブックを表すメモリ上の表現です。シート、セル、スタイル、定義名、テーブルと、再計算を駆動するエンジン状態をまとめます。ホスト API は生バイト列ではなくこのモデルに対して操作します。
:::

## プロファイルに合わせたワークブックを作成する

`createDefault()` / `create_default()` は、既定の実行時プロファイル `win-365-en_US` と `Sheet1` という 1 枚のシートを持つワークブックを作成します。Excel が指定ロケールで新規作成するテンプレートから始める場合は、WASM または Native Node で `createForProfile(profileId)`、Python で `create_for_profile(profile_id)` を呼び出します。このファクトリはプロファイル、本文フォント、ローカライズされた標準スタイル名と最初のシート名、ページ余白、Mac の行高と基準列幅を設定します。CJK ロケールには、ふりがなフォントと垂直方向中央揃えの標準スタイルも設定します。Mac の既定値は実測値、Windows の既定値は推定値です。テーマパーツは作成せず、エンジンは Office の既定テーマを解決します。

::: code-group

```ts [WASM]
// Module is initialized with await createFormulon().
const wb = Module.Workbook.createForProfile('mac-365-ja_JP')
try {
  if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
  console.log(wb.excelProfileId().value, wb.getFont(0).name)
} finally {
  wb.delete()
}
```

```ts [Native Node]
import { Workbook } from '@libraz/formulon-native'

const wb = Workbook.createForProfile('mac-365-ja_JP')
try {
  console.log(wb.excelProfileId().value, wb.getFont(0).name)
} finally {
  wb.dispose()
}
```

```python [Python]
from formulon import Workbook

with Workbook.create_for_profile("mac-365-ja_JP") as wb:
    print(wb.excel_profile_id(), wb.get_font(0).name)
```

:::

ロード済みワークブックで `setExcelProfileId()` / `set_excel_profile_id()` を呼び出すと、実行時の計算プロファイルが変わり、依存する状態が再計算待ちになります。新規作成用のフォント、シート名、余白などのテンプレート既定値は適用されません。

## 開く

`.xlsx` または `.xlsb` のバイト列を読み込み、使う前にハンドルが有効か確認します。形式はファイル名ではなくパッケージの中身から判定します。

::: code-group

```ts [WASM]
const wb = Module.Workbook.loadBytes(bytes)
if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
```

```ts [Native Node]
import { lastErrorMessage, Workbook } from '@libraz/formulon-native'

const wb = Workbook.loadBytes(bytes)
if (!wb.isValid()) throw new Error(lastErrorMessage())
```

```python [Python]
with Workbook.load(blob) as wb:  # raises FormulonError on failure
    ...
```

:::

リーダーは、セル、数式、スタイル、定義名、テーブル、コメント、ハイパーリンク、結合、入力規則、条件付き書式、ピボットキャッシュ、外部リンク表からモデルを組み立てます。モデル化していないパーツはバイト列のまま保持するので、ファイルを往復させても欠落しません。読み込みの時点では何も計算しません。ピボットキャッシュを元の範囲から作り直すことはなく、`[1]Sheet1!A1` のような外部参照はファイルに保存されたキャッシュ値を読みます。参照元ワークブックを開いたり、ネットワーク先から取得したりはしません。形式ごとに何が保持されるかは [ファイル形式](/ja/workbook/file-formats) を参照してください。

::: warning WASM の Workbook ハンドルはネイティブメモリを保持する
WASM の `Workbook` インスタンスは通常の JS オブジェクトではなく、WASM ヒープ内の C++ メモリを所有します。使い終わったら必ず `wb.delete()` を呼んで解放してください。Native Node は `dispose()` またはガベージコレクションでハンドルを解放します。Python の context manager と CLI プロセスは自動で処理します。
:::

## 編集する

セル・数式・シート構造・定義名・テーブル・スタイルなど、各実行入口が公開しているプロパティは更新できます。WASM、Native Node、Python は広い Workbook API を公開し、CLI はセル直接編集ではなく再計算と調査コマンドに絞っています。

## 再計算

編集を適用したら `recalc()` を呼び、すべての再計算待ちセルのキャッシュ値を数式の最新結果に揃えます。`partialRecalc(viewport)` は、表示したい範囲とその範囲が参照する依存関係だけを更新し、それ以外の再計算待ちセルを残します。詳しくは [再計算](/ja/workbook/recalculation) を参照してください。

## 読む / 保存する

すべての数式キャッシュを最新にする必要がある場合は、読み取りや保存の前に `recalc()` が成功したことを確認してください。`save()` は現在のワークブック状態を書き出す処理であり、独自に再計算はしません。部分再計算では、対象外の数式キャッシュが古いまま残る場合があります。全体再計算が成功した後、値を直接読み出すか、

::: code-group

```ts [WASM / Native Node]
const result = wb.getValue(0, 0, 0) // sheet 0, row 0, col 0
if (!result.status.ok) throw new Error(result.status.message)
const value = result.value
```

```python [Python]
with Workbook.load(blob) as wb:
    wb.recalc()
    value = wb.get_value(0, 0, 0)
    saved = wb.save()
```

:::

または、ワークブック全体をバイト列として書き出せます。

```ts
const saved = wb.save()
if (!saved.status.ok || saved.bytes === null) {
  throw new Error(saved.status.message)
}
```

全体再計算の成功後に保存したバイト列には、計算エンジンを持たない下流ツールが参照できる数式とキャッシュ値が含まれます。

## スレッドと再利用

`recalc()` はどの実行入口でも直列に計算します。`recalcParallel(threadCount)`（WASM と Native Node）は、ビルドがワーカースレッドを持っていれば同じ計算をワーカーで実行します。`threadCount` は、`0` なら自動検出（上限 8）、`1` なら呼び出し元スレッドのみ、`2`〜`8` ならその数を上限にします。どちらの経路でも結果は `recalc()` と同じです。

- 標準の `@libraz/formulon` WASM パッケージは単一スレッドで、クロスオリジン分離を必要としません。`recalcParallel()` も動作し、`workerThreadsStarted: 0` を返します。pthread ワーカーを使う場合は `@libraz/formulon/threads` をインポートします。ブラウザでは COOP/COEP ヘッダーが必要です。
- `@libraz/formulon-native` は pthread 付きでビルドされています。
- Python は直列に再計算します。
- CLI は、`recalc` に `--threads` を指定しない限り直列です。

`Workbook` ハンドルは **複数のスレッドや Worker で共有できません**。並行して再計算する場合は、Worker ごとに独立した `Workbook` インスタンスを用意してください。

<DiagramLayers :layers="[
  { title: 'Worker', nodes: [
      { label: 'Worker 1', note: 'Workbook ハンドルを 1 つ所有' },
      { label: 'Worker 2', note: 'Workbook ハンドルを 1 つ所有' },
      { label: 'Worker N', note: 'Workbook ハンドルを 1 つ所有' }
    ] },
  { title: 'ハンドル', nodes: [
      { label: 'Workbook A', note: '1 つの Worker だけが使う' },
      { label: 'Workbook B', note: '1 つの Worker だけが使う' },
      { label: 'Workbook N', note: '1 つの Worker だけが使う' }
    ] }
]" label="各 Worker が独立した Workbook ハンドルを所有し、Worker 間でハンドルを共有することはない" caption="Workbook ハンドルは複数のスレッドや Worker で共有できないため、並行して再計算するなら Worker ごとに 1 つずつインスタンスを持たせます。" />

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 構造編集
- [再計算](/ja/workbook/recalculation) ─ 編集と読み取りの間で起きる処理
- [トラブルシュート](/ja/start/troubleshooting) ─ ライフサイクル中によくある失敗
