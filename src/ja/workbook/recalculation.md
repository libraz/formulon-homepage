# 再計算

再計算はワークブックの編集を更新済みの計算値へ反映する工程です。WASM・Python・Native Node・CLI・MCP のいずれも同じ再計算コアを経由するため、実行入口による挙動のずれは起きない設計になっています。

::: info 用語: dependency graph（依存関係グラフ）
数式から構築される有向グラフです。各数式セルは参照しているセル・定義名・外部リンクを指しており、エンジンはこれを使って計算順序を決めます。
:::

::: info 用語: dirty cell（再計算待ちのセル）
依存先の値が変わったため、計算値が古い可能性があるとエンジンがマークしたセルです。全体再計算はこの集合を評価して再計算済みに戻します。
:::

## エンジンが管理する状態

| 状態 | 用途 |
| --- | --- |
| 依存関係グラフ | 数式セル・定義名・テーブル・外部リンク間の前向き / 後ろ向きエッジ |
| 再計算待ちのセル（dirty） | 読み取り前に再評価が必要なセル |
| 揮発性関数 | `NOW` / `TODAY` / `RAND` / `RANDBETWEEN` / `RANDARRAY` / `OFFSET` / `INDIRECT` / `INFO` / `CELL` / `FORMULATEXT` / `SHEET` / `SHEETS`。常に再計算待ちとして扱います |
| ワークブックの時計 | `NOW`、`TODAY`、ピボットの相対期間フィルターで共有する任意の現地時刻 |
| 反復計算の設定 | 循環参照を許容するための反復計算の有効化・最大回数・収束しきい値 |
| 動的配列のスピル形状 | 起点セルごとの結果形状。依存セルの再形状・無効化に使います |
| 計算モード | 手動 / 自動の切り替え（トグルを公開している実行入口のみ） |

<DiagramLayers :layers="[
  { title: '編集', nodes: [{ label: '編集 / set_cell' }, { label: '揮発性関数', note: 'NOW・RAND・INDIRECT・…' }] },
  { title: '再計算待ちの追跡', nodes: [{ label: '再計算待ちのマーク', note: '依存関係グラフを逆向きに辿る' }] },
  { title: '再計算', nodes: [{ label: 'recalc / partialRecalc', note: '全体または要求された依存関係を評価' }] },
  { title: 'セル単位', nodes: [{ label: '通常の結果', note: '値を書き込む' }, { label: '動的配列', note: 'スピル形状を更新し、依存先を無効化' }] },
  { title: '完了', nodes: [{ label: '再計算済みに戻す', note: '全体再計算ならすべての待機セルを処理し、部分再計算なら要求範囲を最新にする' }] }
]" />

この依存関係グラフは読み出すこともできます。WASM と Native Node の `precedents(sheet, row, col, depth)` は参照元のセルを、`dependents(...)` は参照先のセルを返します。下のパネルであらかじめ数式を並べたシートのセルを選ぶと、矢印はこの 2 つの呼び出しが返したアドレスだけから描かれます。`depth` を上げていくと、`D1` の背後にある依存の連鎖を 1 列ずつ遡り、最終的に A 列の定数まで辿れます。

<TraceDemo />

## 全体再計算と部分再計算

`recalc()` はすべての再計算待ちセルをトポロジカル順で再評価します。`partialRecalc()` は WASM・Native Node・Python のいずれでも使え、指定した表示範囲を最新にするために必要な数式セルと、その数式が参照する先行セルを再計算します。依存関係の外にある再計算待ちセルは残ります。表示したい出力セルを viewport に指定し、ワークブック全体を更新するときは `recalc()` を使ってください。

範囲の境界は両端を含みます。たとえば `B1` が `A1` を、`C1` が `B1` を参照している場合、`A1` の編集後に `B1:C1` を指定すると、表示する 2 セルとその先行セルが更新されます。

::: code-group

```ts [WASM / Native Node]
const result = wb.partialRecalc({
  sheet: 0, firstRow: 0, lastRow: 0, firstCol: 1, lastCol: 2,
})
if (!result.status.ok) throw new Error(result.status.message)
console.log(`recomputed ${result.recomputed} cell(s)`)
```

```python [Python]
recomputed = wb.partial_recalc(
    sheet=0, first_row=0, last_row=0, first_col=1, last_col=2,
)
print(f"recomputed {recomputed} cell(s)")
```

:::

::: info 用語: 揮発性関数 (volatile function)
引数以外のもの（時刻・乱数・外部参照など）に値が依存する関数。引数が変わらなくても再計算のたびに評価され、依存先のセルを毎回再計算待ち集合に引き込みます。
:::

## 時計に依存する計算の固定

ワークブックに固定した時計がない場合、`NOW()`、`TODAY()`、ピボットの相対期間フィルターはホストの時計を読み取ります。読み取りごとに別の時刻になる可能性があり、日付が変わる境界では 1 回の再計算の中でも結果が一致しないことがあります。固定時刻を設定すると、すべてが 1 つの現地時刻を共有して再現可能な再計算になります。

WASM では `pinnedNow()`、`setPinnedNow(year, month, day, hour, minute, second)`、`clearPinnedNow()` を使います。Python では対応する `pinned_now()`、`set_pinned_now(...)`、`clear_pinned_now()` を使います。WASM の getter は `{ status, now }` を返すため、`now` を読む前に `status` を確認してください。`now` は `CivilTime`（`year`、`month`、`day`、`hour`、`minute`、`second`）またはホストの時計を使う状態で `null` です。Python は `CivilTime` または `None` を直接返します。

```ts
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
checkStatus(wb.setPinnedNow(2026, 8, 19, 12, 0, 0))
checkStatus(wb.recalc())
const pin = wb.pinnedNow()
if (!pin.status.ok) throw new Error(pin.status.message)
const now = pin.now
checkStatus(wb.clearPinnedNow())
```

固定時刻はタイムスタンプではなく現地時刻の各フィールドとして保持するため、タイムゾーンの解釈はありません。`setPinnedNow()` は 1900–9999 の範囲外の年、1–12 の範囲外の月、その月に存在しない日、0–23 の範囲外の時、0–59 の範囲外の分 / 秒を拒否し、不正な値を別の日付へ繰り上げません。固定時刻の設定・解除ではキャッシュ済みの数式値を再計算しないため、変更後は `recalc()` を呼び出してください。固定時刻はファイル状態ではなくモデル状態です。保存時には記録されず、読み込み直後のワークブックは固定されていないためホストの時計に従います。

## `INDIRECT` と R1C1 参照

`INDIRECT(ref_text, FALSE)` は `ref_text` を R1C1 文字列として解析します。絶対参照は `R5C2` のように書き、相対軸は `R[-1]C` のように数式を置いたセルを基準に解決します。`R` または `C` だけを指定すると現在の行または列を表し、1 軸だけを持つ端点はもう一方の軸全体を対象にします（`R5` は `5:5` と同じく 5 行全体です）。`a1` 引数はフォールバックを追加するのではなく文法を選択するため、`FALSE` に A1 文字列を渡した場合と、`TRUE` に R1C1 文字列を渡した場合は `#REF!` になります。相対 R1C1 文字列を、基準となる数式セルを持たないアドホック評価入口から評価した場合も `#REF!` になります。

## 反復計算

利息計算や goal-seek のように意図的な循環参照を持つワークブックでは反復計算を有効にします。エンジンは循環部分を繰り返し評価し、前後の変化量が許容値を下回るか上限回数に達した時点で停止します。

```ts
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
checkStatus(wb.setIterative(/*enabled*/ true, /*maxIterations*/ 100, /*maxChange*/ 0.001))
checkStatus(wb.setIterativeProgress((iteration, maxResidual) => {
  console.log(`iteration ${iteration}, max residual ${maxResidual}`)
  return true // false で計算を中断
}))
checkStatus(wb.recalc())
```

`setIterativeProgress()` は、循環部分グラフを 1 回 Gauss-Seidel で走査するたびに呼ばれるコールバックを登録します。反復回数の上限を渡す引数ではありません — それは `setIterative()` の第 2・第 3 引数です。このコールバックは WASM と Native Node のみで使えます。Python の `set_iterative()` は同じ 3 引数を受け取りますが、1 走査ごとの進捗コールバックはバインドされていません（ネイティブ関数ポインタが必要で、Python ホスト側では合成できないためです）。

WASM と Native Node では `getIterative()`、Python では `get_iterative()` で、`{ status, enabled, maxIterations, maxChange }`（Python は対応する snake_case）を読み出せます。`maxIterations` を設定すると値は `32767` までに制限され、getter は制限後の値を返します。読み込んだワークブックの `iterateCount` がそれを超えている場合も同じ上限が適用されます。ホスト UI に実際に使われる値を表示するときは、設定後に読み戻してください。

::: warning 反復計算を無効にした循環は要確認
反復計算が無効な場合、通常の未解決循環は `#REF!` になります。`OFFSET` や `INDIRECT` などの動的参照を通る循環では、直前のキャッシュ値が残る場合があります。利用できる循環統計で対象セルを確認してください。いずれもホスト側の例外にはなりません。循環参照を意図する場合は反復計算を明示的に有効にしてください。
:::

下のパネルは、ここで説明した 3 つの引数をそのまま操作できる形で、2 セルの循環を解きます。`maxChange` を小さくするほど、そこへ収まるまでの走査回数は増えます。収束に必要な回数より小さい上限を選ぶと解が途中で打ち切られ、最終残差が判定線の上にあるまま未収束として報告されます。

<IterativeDemo />

## 速さより正しさ

すべての再計算は tree-walker で行います。リリース・開発・テストビルドには評価器と評価経路が 1 つだけあります。互換性の判定には Excel から取得したゴールデンデータ（コミット済みの参照値）を使い、これと一致しない速度最適化は受け付けません。

## 次に読むもの

- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・エラー伝播
- [動的配列](/ja/workbook/dynamic-arrays) ─ スピル形状と再計算の関係
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 参照値の取得方法
