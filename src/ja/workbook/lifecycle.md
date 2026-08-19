# ワークブックの流れ

ほとんどの組み込みは同じ流れです。バイト列を開き、編集し、再計算し、値を読むか保存する。どこで何が起きるかを把握しておくと、計算・入出力・UI・永続化の責務を分けやすくなります。

<DiagramFlow steps="ワークブックのバイト列を開く → ワークブックモデルにパース → 編集を適用 → 依存関係グラフを構築 / 更新 → 再計算 → 値を読む、またはバイト列を保存" />

::: info 用語: ワークブックモデル
パース後のワークブックを表すメモリ上の表現です。シート、セル、スタイル、定義名、テーブルと、再計算を駆動するエンジン状態をまとめます。ホスト API は生バイト列ではなくこのモデルに対して操作します。
:::

## 開く

ファイル形式層が workbook parts、relationships、shared strings、styles、worksheets、defined names、tables、comments、hyperlinks、merges、validations、conditional formatting、pivot cache、その他拡張パートを読み込みます。意味解釈しないパートは保持対象として扱い、保存時に欠落しないようにします。

入力規則はドロップダウン表示状態のフラグ（`show_dropdown`）を公開します。OOXML では `showDropDown` の意味が反転して保存されるため、Formulon はホスト API 向けに扱いやすい意味へ正規化し、保存時に正しい package 表現へ戻します。

ロード後は必ず妥当性を確認します。

```ts
const wb = Module.Workbook.loadBytes(bytes)
if (!wb.isValid()) {
  throw new Error(Module.lastErrorMessage())
}
```

```python
with Workbook.load(blob) as wb:
    ...
```

::: warning WASM の Workbook ハンドルはネイティブメモリを保持する
WASM の `Workbook` インスタンスは通常の JS オブジェクトではなく、WASM ヒープ内の C++ メモリを所有します。使い終わったら必ず `wb.delete()` を呼んで解放してください。Python の context manager と CLI プロセスは自動で処理します。
:::

## 編集する

セル・数式・シート構造・定義名・テーブル・スタイルなど、各実行入口が公開しているプロパティは更新できます。WASM、Native Node、Python は広い Workbook API を公開し、CLI はセル直接編集ではなく再計算と調査コマンドに絞っています。

## 再計算

編集を適用したら `recalc()`（または増分用の `partialRecalc()`）を呼び、キャッシュ値を数式の最新結果に揃えます。dirty 集合・揮発性関数・反復計算の挙動は [再計算](/ja/workbook/recalculation) を参照してください。

## 読む / 保存する

再計算後は値を直接読み出すか、

```ts
const result = wb.getValue(0, 0, 0) // sheet 0, row 0, col 0
if (!result.status.ok) throw new Error(result.status.message)
const value = result.value
```

ワークブック全体をバイト列として書き出せます。

```ts
const saved = wb.save()
if (!saved.status.ok || saved.bytes === null) {
  throw new Error(saved.status.message)
}
```

保存されるバイト列は数式とキャッシュ値が整合しているため、計算エンジンを持たない下流ツールでも正しい値を読み取れます。

## スレッドと再利用

WASM ビルドの再計算エンジンは内部で pthread worker を使います。`Workbook` ハンドル自体は **複数のスレッド / Worker で共有できません**。並行で再計算したい場合は、Worker ごとに独立した `Workbook` インスタンスを用意してください — 共有する状態がそもそも存在しないので、同期の必要もありません。

<DiagramLayers :layers="[
  { title: 'Worker', nodes: ['Worker 1', 'Worker 2', 'Worker N'] },
  { title: 'ハンドル', nodes: ['Workbook A', 'Workbook B', 'Workbook N'] }
]" label="各 Worker が独立した Workbook ハンドルを所有し、Worker 間でハンドルを共有することはない" />

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ sheet / cell / 構造編集
- [再計算](/ja/workbook/recalculation) ─ 編集と読み取りの間で起きる処理
- [トラブルシュート](/ja/start/troubleshooting) ─ ライフサイクル中によくある失敗
