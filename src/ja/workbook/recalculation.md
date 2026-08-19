# 再計算

再計算はワークブックの編集を更新済みの計算値へ反映する工程です。WASM・Python・Native Node・CLI・MCP のいずれも同じ再計算コアを経由するため、実行入口による挙動のずれは起きない設計になっています。

::: info 用語: dependency graph（依存関係グラフ）
数式から構築される有向グラフ。各数式セルは参照しているセル・defined name・external link を指しており、これによって engine は計算順序を決定し、変更があった範囲だけを再計算できます。
:::

::: info 用語: dirty cell（dirty なセル）
依存先の値が変わったため、現在の計算値が古い可能性があると engine がマークしたセルのこと。再計算はこの dirty 集合だけを評価して clean に戻します。
:::

## Engine が管理する状態

| 状態 | 用途 |
| --- | --- |
| 依存関係グラフ | 数式セル・defined name・table・external link 間の前向き / 後ろ向きエッジ |
| dirty 集合 | 読み取り前に再評価が必要なセル |
| 揮発性関数 | `NOW` / `TODAY` / `RAND` / `INDIRECT` / `OFFSET` / `INFO` など、常に dirty 扱いの関数 |
| ワークブックの時計 | `NOW`、`TODAY`、pivot の相対期間フィルターで共有する任意の local civil time |
| iterative 設定 | 循環参照を許容するための iteration 有効化・最大回数・収束しきい値 |
| 動的配列のスピル形状 | アンカーごとの結果 shape。依存セルの再 shape / 無効化に使う |
| 計算モード | manual / automatic 切替（トグルを公開している実行入口のみ） |

<DiagramLayers :layers="[
  { title: '編集', nodes: [{ label: '編集 / set_cell' }, { label: '揮発性関数', note: 'NOW・RAND・INDIRECT・…' }] },
  { title: 'dirty 追跡', nodes: [{ label: 'dirty マーク', note: '依存関係グラフを逆向きに辿る' }] },
  { title: '再計算', nodes: [{ label: 'recalc / partialRecalc', note: 'dirty 集合をトポロジカル順で評価' }] },
  { title: 'セル単位', nodes: [{ label: '通常の結果', note: '値を書き込む' }, { label: '動的配列', note: 'スピル形状を更新し、依存先を無効化' }] },
  { title: '完了', nodes: [{ label: 'clean に戻す', note: 'dirty が無くなるまで繰り返し、その後の読み取りが valid になる' }] }
]" />

この依存関係グラフは読み出すこともできます。WASM と Native Node の `precedents(sheet, row, col, depth)` は参照元のセルを、`dependents(...)` は参照先のセルを返します。下のパネルであらかじめ数式を並べたシートのセルを選ぶと、矢印はこの 2 つの呼び出しが返したアドレスだけから描かれます。depth を上げていくと、`D1` の背後にある依存の連鎖を 1 列ずつ遡り、最終的に A 列の定数まで辿れます。

<TraceDemo />

## 全体再計算と partial recalc

`recalc()` はすべての dirty セルをトポロジカル順で再評価します。`partialRecalc()` は WASM・Native Node・Python のいずれでも使え、dirty 集合全体ではなく、指定した viewport 範囲内のセル(とその依存先)だけを再計算します。変更箇所が 1 セルの編集や小規模なバッチのように完全に分かっている場合に使うと、依存ファンアウトの分だけで済みます。

::: info 用語: 揮発性関数 (volatile function)
引数以外のもの（時刻・乱数・外部参照など）に値が依存する関数。引数が変わらなくても再計算のたびに評価され、依存先のセルを毎回 dirty 集合に引き込みます。
:::

## 時計に依存する計算の固定

ワークブックに固定した時計がない場合、`NOW()`、`TODAY()`、pivot の相対期間フィルターはホストの時計を読み取ります。読み取りごとに別の時刻になる可能性があり、日付が変わる境界では 1 回の再計算の中でも結果が一致しないことがあります。pin を設定すると、すべてが 1 つの local civil time を共有して再現可能な再計算になります。

WASM では `pinnedNow()`、`setPinnedNow(year, month, day, hour, minute, second)`、`clearPinnedNow()` を使います。Python では対応する `pinned_now()`、`set_pinned_now(...)`、`clear_pinned_now()` を使います。getter は `CivilTime`（`year`、`month`、`day`、`hour`、`minute`、`second`）を返し、ホストの時計を使う状態では `null` / `None` を返します。

```ts
wb.setPinnedNow(2026, 8, 19, 12, 0, 0)
wb.recalc()
const pin = wb.pinnedNow()
wb.clearPinnedNow()
```

pin は timestamp ではなく local civil field として保持するため、タイムゾーンの解釈はありません。`setPinnedNow()` は 1900–9999 の範囲外の year、1–12 の範囲外の month、その月に存在しない day、0–23 の範囲外の hour、0–59 の範囲外の minute / second を拒否し、不正な値を別の日付へ繰り上げません。pin の設定・解除ではキャッシュ済みの数式値を再計算しないため、変更後は `recalc()` を呼び出してください。pin はファイル状態ではなくモデル状態です。保存時には記録されず、読み込み直後のワークブックは pin されていないためホストの時計に従います。

## `INDIRECT` と R1C1 参照

`INDIRECT(ref_text, FALSE)` は `ref_text` を R1C1 文字列として解析します。絶対参照は `R5C2` のように書き、相対軸は `R[-1]C` のように数式を置いたセルを基準に解決します。`R` または `C` だけを指定すると現在の行または列を表し、1 軸だけを持つ endpoint はもう一方の軸全体を対象にします（`R5` は `5:5` と同じく 5 行全体です）。`a1` 引数は fallback を追加するのではなく文法を選択するため、`FALSE` に A1 文字列を渡した場合と、`TRUE` に R1C1 文字列を渡した場合は `#REF!` になります。相対 R1C1 文字列を、基準となる数式セルを持たない ad-hoc 評価入口から評価した場合も `#REF!` になります。

## 反復計算（iterative calculation）

利息計算や goal-seek のように意図的な循環参照を持つワークブックでは iterative calculation を有効にします。Engine は循環部分を繰り返し評価し、前後の変化量が許容値を下回るか上限回数に達した時点で停止します。

```ts
wb.setIterative(/*enabled*/ true, /*maxIterations*/ 100, /*maxChange*/ 0.001)
wb.setIterativeProgress((iteration, maxResidual) => {
  console.log(`iteration ${iteration}, max residual ${maxResidual}`)
  return true // false で solve を中断
})
wb.recalc()
```

`setIterativeProgress()` は、循環部分グラフを 1 回 Gauss-Seidel で走査するたびに呼ばれる callback を登録します。iteration 回数の上限を渡す引数ではありません — それは `setIterative()` の第 2・第 3 引数です。この callback は WASM と Native Node のみで使えます。Python の `set_iterative()` は同じ 3 引数を受け取りますが、1 走査ごとの progress callback はバインドされていません(ネイティブ関数ポインタが必要で、Python ホスト側では合成できないため)。

::: warning iteration 無効時の循環は error
iteration が無効な状態で循環が存在する場合、該当セルは `#REF!` / `#NUM!` などの Excel error 値を返します。ホスト側の例外にはなりません。循環参照を意図する場合は必ず iteration を有効にしてください。
:::

下のパネルは、ここで説明した 3 つの引数をそのまま操作できる形で、2 セルの循環を解きます。`maxChange` を小さくするほど、そこへ収まるまでの走査回数は増えます。収束に必要な回数より小さい上限を選ぶと解が途中で打ち切られ、最終残差が判定線の上にあるまま未収束として報告されます。

<IterativeDemo />

## 速さより正しさ

本番の再計算は tree-walker で行い、リリース用の CLI・WASM・バインディングバイナリには実験的な bytecode compiler・optimizer・VM を含めません。開発・テストビルドでは `FORMULON_BUILD_VM=ON` のときに VM をコンパイルできますが、両方の評価器を実行して比較するのは `FORMULON_VM_PARITY_CHECK=ON` を明示したビルドだけです。通常のテストは二重評価を行いません。互換性の判定には Excel から取得したゴールデンデータ（コミット済みの参照値）を使い、これと一致しない速度最適化は受け付けません。

## 次に読むもの

- [数式エンジン](/ja/workbook/formula-engine) ─ 値の種類・座標・error 伝播
- [動的配列](/ja/workbook/dynamic-arrays) ─ スピル形状と再計算の関係
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 参照値の取得方法
