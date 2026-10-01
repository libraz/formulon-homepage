---
description: 繰り返し数式の欠落、定数、外れ値、エラーを自動修復せずに確認します。
---

# 数式パターンを監査する

`formulon_audit_formulas` は、指定した範囲の数式を近くの数式と比較します。縦方向、横方向、または両方向を選べます。繰り返し範囲にある定数、空白、数式パターンの外れ値、数式エラーを報告します。

この監査は確認のためのツールです。セルを修復せず、数式が正しいことも証明せず、数式が実装する業務ルールも推測しません。すべての行に同じ誤った数式がコピーされていても、近隣の数式との一致だけでは見つかりません。

## 比較の仕組み

サーバーは数式ごとに相対参照のフィンガープリントを作ります。そのため、`=B2*C2` と `=B3*C3` は同じパターンになります。候補セルの前後にある数式セルが、同じ期待パターンを支持した場合だけ候補を報告します。完全に空の行または列は境界です。その境界を越えた数式は近隣セルとして使いません。

入力列を監査範囲に含めてください。入力が `B:C`、計算式が `D` にある表では、`D2:D200` だけでなく `B2:D200` を監査します。入力セルによって各データ行が埋まるため、計算結果が空のセルと区切り用の空行を区別できます。見出し、合計、意図的な上書き、業務ルールの確認は別途必要です。

検出する種類は次の 4 つです。

| 種類 | 意味 |
| --- | --- |
| `constant_in_formula_run` | 近隣の行または列が同じ数式パターンなのに、数式ではない値があります。 |
| `blank_in_formula_run` | 支持された数式範囲の途中に空セルがあります。 |
| `formula_pattern_outlier` | 数式はありますが、近隣から推定したパターンと異なります。 |
| `formula_error` | 数式の現在値が Excel のエラー値です。近隣のパターンがなくても検出します。 |

`direction` は縦方向、横方向、両方向から選べます。`both` では同じセルに複数の問題が付く場合があります。その場合、検出項目の `direction` は `"both"` になり、寄与した軸が `directions` に入ります。

## 入力と上限

`formulon_audit_formulas` の入力は次のとおりです。

| 項目 | 既定値と制約 |
| --- | --- |
| `sessionId` | 開いているセッションを必ず指定します。 |
| `sheet` | 省略すると最初のシートです。シート名または 0 始まりの番号を使います。 |
| `range` | 省略可能な A1 範囲です。シート名付きの範囲はそのシートを選びます。省略すると、保存されているセルで構成した使用範囲全体を監査します。 |
| `direction` | 既定値は `"vertical"` です。`"horizontal"` と `"both"` も使えます。 |
| `window` | 既定値は `5` です。`2` から `50` の整数です。 |
| `minPeers` | 既定値は `3` です。`3` から `20` の整数で、`2 * window` 以下にします。 |
| `maxCells` | 既定値は `50_000` です。`1` から `50_000` の整数です。選択範囲のセル数がこの値を超えるとエラーになります。 |
| `maxFindings` | 既定値は `100` です。`1` から `500` の整数です。 |
| `recalc` | 既定値は `false` です。`true` にすると値を読む前に再計算し、セッションを変更あり（dirty）にします。 |

`range` を省略した場合、使用範囲全体を暗黙に切り詰めません。範囲を明示した場合は、走査前に面積を検証します。数式と使用範囲を調べるため、シートに保持されているセルを列挙します。保持されているセル数が 1,000,000 を超えるシートは拒否されます。狭い範囲を明示しても、この列挙上限は回避できません。

1 件の検出項目に含まれる数式文字列は 256 文字、正規化したパターンは 1,024 文字までです。切り詰めた場合は `formulaTextTruncated`、`patternTextTruncated`、`expectedPatternTextTruncated` が示されます。検出項目内のテキスト値も 256 文字までで、必要な場合は `textTruncated` が付きます。

## 応答の項目

応答の外側は次の形です。

```json
{
  "complete": true,
  "session": { "id": "formula-review", "dirty": false },
  "sheet": 0,
  "sheetName": "Sheet1",
  "range": "B2:D12",
  "direction": "vertical",
  "window": 5,
  "minPeers": 3,
  "scannedCells": 33,
  "formulaCells": 9,
  "unsupportedFormulaCells": 0,
  "findingCount": 4,
  "findings": [],
  "findingsTruncated": false,
  "warnings": []
}
```

上の空の `findings` 配列は外側の形式だけを示すための省略です。各検出項目には `type`、`direction`、`directions`、`sheet`、`sheetName`、0 始まりの `row` と `col`、A1 の `a1`、シート名付きの `ref`、現在の `value`、`count`、`considered`、`nearestSamples`、`confidence`、`issues` 配列、固定の `reviewNote` が入ります。数式の検出項目には `formula`、パターンの検出項目には `pattern` と、近隣に期待パターンがあれば `expectedPattern` も入ります。`nearestSamples.before` と `.after` には、最大 3 件の近隣の数式・定数・空白セルが A1 アドレス、値、取得できた数式とパターン付きで入ります。

`confidence` は支持した近隣セルの割合を小数第 2 位に丸め、最大 `0.99` に制限した値です。数式エラーは `1` です。`unsupportedFormulaCells` は、パターン比較用に正規化できなかった数式の件数です。これらはパターン比較の対象外になり、`warnings` に理由が示されます。`complete: true` は選択範囲を走査したことを表し、全数式を比較できたことや全検出結果を返したことを保証しません。`unsupportedFormulaCells` と `findingsTruncated` も確認してください。`findingsTruncated` は `maxFindings` を超える検出項目グループがあったことを示し、`findingCount` には検出したグループの総数が残ります。

## 再現例: 計算列を確認する

次のプロンプトは、数式を黙って修正せずにコピー漏れを見つけるようエージェントへ指示します。

```text
`formula-review` というセッションで計算用ワークブックを開いてください。Data!B2:D12 を縦方向に監査し、window は 5、minPeers は 3、maxCells は 50、recalc は true にします。空行を境界として扱えるよう、値が入っている入力列 B:C も範囲に含めてください。すべての検出項目を A1 アドレスと種別で報告してください。検出項目を確認するまで修復しないでください。監査範囲を数式付きで読み取り、/tmp/formula-review.png へプレビューし、確認済みのセッションを /tmp/formula-review.xlsx に保存して損失情報を確認し、セッションを閉じてください。
```

再現用の小さなデータセットを持つ空のワークブックを開きます。

#### `formulon_open_workbook`

```json
{
  "sessionId": "formula-review"
}
```

修飾付きの `Data!` 範囲へ書き込む前に、最初のシート名を変更します。

#### `formulon_sheet_operation`

```json
{
  "sessionId": "formula-review",
  "operation": "rename",
  "index": 0,
  "newName": "Data"
}
```

入力列と繰り返し数式を書き込みます。入力値によって選択範囲の各行が埋まります。`D5` は定数、`D7` は空白、`D9` は異なる数式パターン、`D11` は再計算後に数式エラーになります。

#### `formulon_set_range`

```json
{
  "sessionId": "formula-review",
  "start": "Data!B2",
  "values": [
    [2, 2, { "f": "=B2*C2" }],
    [3, 2, { "f": "=B3*C3" }],
    [4, 2, { "f": "=B4*C4" }],
    [5, 2, 99],
    [6, 2, { "f": "=B6*C6" }],
    [7, 2, { "blank": true }],
    [8, 2, { "f": "=B8*C8" }],
    [9, 2, { "f": "=B9+C9" }],
    [10, 2, { "f": "=B10*C10" }],
    [11, 2, { "f": "=1/0" }],
    [12, 2, { "f": "=B12*C12" }]
  ],
  "recalc": true
}
```

選択した範囲を監査します。ツール名を JSON の直前に置いているため、エージェントはそのまま実行できます。

#### `formulon_audit_formulas`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "direction": "vertical",
  "window": 5,
  "minPeers": 3,
  "maxCells": 50,
  "maxFindings": 100,
  "recalc": true
}
```

確認できる検出項目のアドレスと種類は次のとおりです。

```text
D5  constant_in_formula_run
D7  blank_in_formula_run
D9  formula_pattern_outlier
D11 formula_error
```

外側の応答は `scannedCells: 33`、`formulaCells: 9`、`findingCount: 4`、`findingsTruncated: false` を返し、各検出項目に確認用の注記を付けます。`D11` はエラー値を持ち、`expectedPattern` は不要です。フィンガープリントの文字列は `pattern` と `expectedPattern` で返るため、アドレスから組み立てないでください。

修復を決める前に範囲を読み取ります。

#### `formulon_get_range`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "includeFormulas": true,
  "recalc": false,
  "maxCells": 50
}
```

応答は空セルを省略し、保持されているセルの値エンベロープと数式文字列を返します。`nearestSamples` と周辺の業務情報を使って、各候補が意図的な上書きかどうかを判断します。監査だけでは意図的な上書きと誤入力を区別できません。

## 確認後に明示的に修復し、再実行する

確認したセルだけを呼び出し側の承認後に修復します。次の入力は 4 件の検出項目の数式パターンを復元します。

#### `formulon_set_cells`

```json
{
  "sessionId": "formula-review",
  "recalc": true,
  "mutations": [
    { "type": "formula", "a1": "Data!D5", "formula": "=B5*C5" },
    { "type": "formula", "a1": "Data!D7", "formula": "=B7*C7" },
    { "type": "formula", "a1": "Data!D9", "formula": "=B9*C9" },
    { "type": "formula", "a1": "Data!D11", "formula": "=B11*C11" }
  ]
}
```

この数式では変更の応答に空の `errorCells` 配列が含まれます。修復した範囲を読み、同じ監査をもう一度実行します。

#### `formulon_audit_formulas`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "direction": "vertical",
  "window": 5,
  "minPeers": 3,
  "maxCells": 50,
  "recalc": true
}
```

このデータセットの再実行結果は `findingCount: 0` と `warnings: []` です。選択したセルが近隣セルと一致し、現在の数式エラーがないことを示します。乗算が業務上の正しい計算であることまでは示しません。

修復後の範囲をプレビューします。

#### `formulon_preview_range`

```json
{
  "sessionId": "formula-review",
  "range": "Data!B2:D12",
  "scale": 1,
  "showGridLines": true,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/formula-review.png"
}
```

最初の MCP コンテンツは PNG 画像です。続く JSON メタデータに、範囲、現在の表示文字列とセル位置、改ページ、フォント、ページ数、近似に関する警告が入ります。

別の出力先へ保存し、`losses` を確認してからセッションを終了します。

#### `formulon_save_session`

```json
{
  "sessionId": "formula-review",
  "outputPath": "/tmp/formula-review.xlsx"
}
```

#### `formulon_close_workbook`

```json
{
  "sessionId": "formula-review"
}
```

## 再計算と失敗時の境界

`recalc: false` では、現在キャッシュされている値を読み取ります。`recalc: true` では、値を更新する前にセッションを変更あり（dirty）にします。再計算はエラーを報告する前にキャッシュ値を一部変更する場合があるためです。再計算が失敗した場合は、保存または入力元の再オープンを決める前にセッションを調べます。

監査自体は数式を書き込みません。読み取りが成功しただけなら変更あり（dirty）フラグは変わりません。確認済みワークブックは通常 XLSX へ保存し、完全な成果物として扱う前に書き込み時の `losses` を確認します。
