# 数式エンジン

評価器は、スカラー値、範囲、配列、エラー、参照、ロケール依存の挙動を Excel と一致させることを目指しています。Formulon は認識対象の関数名を起動時に登録し、各バインディングはその中で評価できる関数を呼び出せます。

::: info 用語: tree-walker と実験的 bytecode VM
リリース用の CLI・WASM・バインディングバイナリは、パース済み AST を直接解釈する tree-walker を使い、実験的な bytecode compiler・optimizer・VM は含みません。開発・テストビルドでは `FORMULON_BUILD_VM=ON` のときだけ VM をコンパイルできます。
:::

::: info 用語: value kind（値の種類）
セル値・数式結果に付く弁別子です。`Blank` / `Number` / `Bool` / `Text` / `Error` / `Array` / `Ref` / `Lambda` の 8 種類があります。各バインディングは enum として公開します（例: WASM `ValueKind.Number`、Python `ValueKind.NUMBER`）。
:::

<DiagramFlow :steps="[
  { label: '数式テキスト', note: '=SUM(A1:A10)' },
  { label: '字句 / 構文解析' },
  { label: 'AST' },
  { label: '参照解決', note: 'names・tables・ranges' },
  { label: '評価器', note: '本番は tree-walker。明示した開発・テストの parity ビルドだけ実験的 VM を使う' },
  { label: 'Value', note: 'Number・Text・Bool・Error・Array・Ref・Lambda・Blank' }
]" />

## 認識対象の関数

Formulon は、数学、統計、論理、テキスト、日付 / 時刻、検索、財務、エンジニアリング、情報、データベース、Web、キューブ、`LET` / `LAMBDA` / 動的配列系など、合計 522 件の Excel 関数名を認識します。これは認識カタログであり、Microsoft 365 の外部サービスに依存する関数まですべてローカル実装済みという意味ではありません。

**507 件の実装（環境依存の `CELL`、`INFO` を含む）と、15 件の未提供スタブで、認識対象は合計 522 件**です。カテゴリ別、状態別の内訳は [数式カバレッジ](/ja/compatibility/formula-coverage) を参照してください。

## 評価モード

本番の評価は tree-walker で行います。開発・テストビルドでは `FORMULON_BUILD_VM=ON` のときに実験的な bytecode VM をコンパイルできますが、両方を実行して結果を比較するのは `FORMULON_VM_PARITY_CHECK=ON` を明示したビルドだけです。通常のテストは二重評価を行いません。

## アドホック評価

同じ評価器の上に、WASM と Native Node は読み取り専用のスカラーアドホック評価 `evaluateFormulaText()` / `evaluateConditionalFormula()` を公開しています。Python は配列全体の `evaluate_formula_array()` と CF 用の `evaluate_cf_formula()` を公開しますが、一般的なスカラー `evaluate_formula_text()` は公開していません。[ワークブック操作 — アドホック数式評価](/ja/workbook/operations#アドホック数式評価) を参照してください。

範囲形の defined name は Array として評価され、スピルによる phantom cell も列挙されます。`date1904` は評価器へ伝わり、行全体 / 列全体や 3-D range はワークブックモデルに基づいて解決されます。配列の broadcasting は関数ごとの Excel 規則に従います。

## エラーの扱い

Excel error はホスト言語の例外ではなく **値** として扱います。

| Excel error | 意味 |
| --- | --- |
| `#DIV/0!` | 0 除算、または除数が空 |
| `#VALUE!` | 引数・オペランドの型不一致 |
| `#REF!` | 参照を解決できない（削除されたシート、壊れた range など） |
| `#NAME?` | 未知の関数 / defined name |
| `#NUM!` | 数値オーバーフローや不正な数値入力 |
| `#N/A` | 値なし。`MATCH` / `VLOOKUP` 系で発生 |
| `#NULL!` | 範囲交差が空 |
| `#SPILL!` | 動的配列のスピルが成立しない（衝突・範囲外） |
| `#CALC!` | エンジンが結果を返せない（再帰・未完了評価など） |
| `#GETTING_DATA` | 外部参照の取得中 |

::: tip セルの error とホスト失敗は別物
`#DIV/0!` を返す数式は API として **失敗していません**。呼び出しは成功しており、結果がエラー値なのです。`value.kind === ValueKind.Error` で判定してください。バイト列不正・ハンドル失効・IO 失敗などはステータス envelope / 例外 / 非ゼロ終了で別経路で報告されます。
:::

## 座標

バインディングは 0 から始まる数値座標を使い、ロケールごとのアドレス解析を避けます。

| Excel のアドレス | バインディングのタプル `(sheet, row, col)` |
| --- | --- |
| `Sheet1!A1` | `(0, 0, 0)` |
| `Sheet1!B4` | `(0, 3, 1)` |
| `Sheet2!C10` | `(1, 9, 2)` |

A1 テキストは CLI 引数・数式文字列・MCP ツール入力など、明示的に要求している場面でのみ受け付けます。

## ロケール依存挙動

テキスト整形・日付パース・通貨・リスト区切りなど、一部関数は有効な互換性プロファイルを参照します。既定は `win-365-ja_JP` です。対応する Oracle データが揃ったプロファイルだけが公開されます。詳しくは [ロケールプロファイル](/ja/compatibility/locale-profiles)。

## 次に読むもの

- [再計算](/ja/workbook/recalculation) ─ エンジンが評価をどう順序付けるか
- [ワークブック操作](/ja/workbook/operations#アドホック数式評価) ─ セルを変更せずに数式を評価する
- [数式カバレッジ](/ja/compatibility/formula-coverage) ─ 関数族ごとの登録状況
- [エラーモデル](/ja/compatibility/errors) ─ エラー値とホスト失敗の違い
