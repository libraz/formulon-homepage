# ワークブックの流れ

ほとんどの組み込みは同じ流れです。ワークブックのバイト列を読み込み、編集と再計算を行い、結果の値を取得するかファイルに保存します。どこで何が起きるかを把握すると、計算・入出力・UI・永続化の責務を分けやすくなります。

<DiagramFlow steps="ワークブックのバイト列を開く → ワークブックモデルにパース → 編集を適用 → 依存関係グラフを構築 / 更新 → 再計算 → 値を読む、またはバイト列を保存" />

::: info 用語: ワークブックモデル
パース後のワークブックを表すメモリ上の表現です。シート、セル、スタイル、定義名、テーブルと、再計算を駆動するエンジン状態をまとめます。ホスト API は生バイト列ではなくこのモデルに対して操作します。
:::

## 開く

ファイル形式層がワークブックのパーツ、リレーションシップ、共有文字列、スタイル、ワークシート、定義名、テーブル、コメント、ハイパーリンク、結合、入力規則、条件付き書式、ピボットキャッシュ、外部リンク表、その他の拡張パーツを読み込みます。意味を解釈しないパーツも保持対象として扱い、保存時に欠落しないようにします。

入力規則はドロップダウン表示状態のフラグ（`show_dropdown`）を公開します。OOXML では `showDropDown` の意味が反転して保存されるため、Formulon はホスト API 向けに正規化し、保存時に正しいパッケージ表現へ戻します。

対応済みの XLSB レコード形式では、ピボットキャッシュ定義、キャッシュレコード、ピボットテーブルの各パーツを OOXML リーダーと同じモデルへ読み込みます。`pivotLayout()` と `GETPIVOTDATA` は対応するキャッシュのレコードを必要に応じて集計・取得しますが、`recalc()` が元シートからピボットキャッシュを再構築することはありません。ふりがな注釈は各 `<rPh>` 要素の UTF-16 範囲を保持します。また外部リンク表の参照元ブックのインデックスも保持するため、`[1]Sheet1!A1` のような数式を対応するキャッシュ値へ解決できます。外部参照のデータ更新はこの流れでは行いません。

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

編集を適用したら `recalc()` を呼び、すべての再計算待ちセルのキャッシュ値を数式の最新結果に揃えます。`partialRecalc(viewport)` は、表示したい範囲とその範囲が参照する依存関係だけを更新し、それ以外の再計算待ちセルを残します。詳しくは [再計算](/ja/workbook/recalculation) を参照してください。

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

標準の `@libraz/formulon` WASM パッケージは単一スレッドで動作し、クロスオリジン分離を必要としません。`recalc()` は直列実行で、`recalcParallel()` も `workerThreadsStarted: 0` の直列フォールバックとして利用できます。pthread ワーカーを有効にする場合は `@libraz/formulon/threads` をインポートし、ブラウザでは COOP/COEP ヘッダーが必要です。Python は直列経路を使い、ネイティブ CLI は標準では直列で、`--threads` を指定したときだけスレッドを選びます。`Workbook` ハンドル自体は **複数のスレッド / Worker で共有できません**。並行で再計算する場合は、Worker ごとに独立した `Workbook` インスタンスを用意してください。

<DiagramLayers :layers="[
  { title: 'Worker', nodes: ['Worker 1', 'Worker 2', 'Worker N'] },
  { title: 'ハンドル', nodes: ['Workbook A', 'Workbook B', 'Workbook N'] }
]" label="各 Worker が独立した Workbook ハンドルを所有し、Worker 間でハンドルを共有することはない" />

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 構造編集
- [再計算](/ja/workbook/recalculation) ─ 編集と読み取りの間で起きる処理
- [トラブルシュート](/ja/start/troubleshooting) ─ ライフサイクル中によくある失敗
