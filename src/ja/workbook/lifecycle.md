# ワークブックの流れ

ほとんどの組み込みは同じ流れです。bytes を開き、編集し、再計算し、値を読むか保存して閉じる ─ どこで何が起きるかを把握しておくと、計算・IO・UI・永続化の責務を分けやすくなります。

```mermaid
flowchart LR
  A[ワークブックの bytes を開く] --> B[ワークブック model にパース]
  B --> C[編集を適用]
  C --> D[依存関係グラフを構築 / 更新]
  D --> E[再計算]
  E --> F[値を読む / bytes を保存]
```

::: info 用語: ワークブック model
パース後のワークブックを表す in-memory 表現。シート・セル・スタイル・defined name・table と、再計算を駆動する engine 状態をまとめたもの。ホスト API は生バイト列ではなくこの model に対して操作します。
:::

## 開く

ファイル形式層が workbook parts、relationships、shared strings、styles、worksheets、defined names、tables、comments、hyperlinks、merges、validations、conditional formatting、pivot cache、その他拡張パートを読み込みます。意味解釈しないパートは passthrough として保持され、保存時に欠落しません。

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

::: warning WASM の Workbook handle はネイティブメモリを保持する
WASM の `Workbook` インスタンスは通常の JS オブジェクトではなく、WASM heap 内の C++ メモリを所有します。使い終わったら必ず `wb.delete()` を呼んで解放してください。Python の context manager と CLI プロセスは自動で処理します。
:::

## 編集する

セル・数式・シート構造・defined name・table・style など、widget の surface が公開しているプロパティは更新できます。WASM が最も広い surface、Python は安定 subset、CLI はセル直接編集ではなく recalc 中心の操作です。

## 再計算

編集を適用したら `recalc()`（または増分用の `partialRecalc()`）を呼び、cached value を数式の最新結果に揃えます。dirty 集合・volatile 関数・iterative calculation の挙動は [再計算](/ja/workbook/recalculation) を参照してください。

## 読む / 保存する

再計算後は値を直接読み出すか、

```ts
const value = wb.getValue(0, 0, 0) // sheet 0, row 0, col 0
```

ワークブック全体を bytes として書き出せます。

```ts
const saved = wb.save()
if (!saved.status.ok || saved.bytes === null) {
  throw new Error(saved.status.message)
}
```

保存される bytes は数式と cached value が整合しているため、計算 engine を持たない下流ツールでも正しい値を読み取れます。

## スレッドと再利用

WASM ビルドの再計算 engine は内部で pthread worker を使います。`Workbook` handle 自体は **複数のスレッド / Worker で共有できません**。並行で再計算したい場合は、Worker ごとに独立した `Workbook` インスタンスを用意してください。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ sheet / cell / 構造編集
- [再計算](/ja/workbook/recalculation) ─ 編集と読み取りの間で起きる処理
- [トラブルシュート](/ja/start/troubleshooting) ─ ライフサイクル中によくある失敗
