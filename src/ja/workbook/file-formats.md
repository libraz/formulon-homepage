# ファイル形式

Formulon は現代的な Office Open XML 系・バイナリ系のスプレッドシート形式を中心にサポートします。各リーダー / ライターの背後には同じ計算コアがあるため、形式層が担うのは構造の保持と機能のマッピングであり、計算挙動は形式によって変わりません。

::: info 用語: OOXML
Office Open XML（ISO/IEC 29500）。`.xlsx` / `.xlsm` / `.xltx` などの ZIP コンテナ形式で、内部は workbook / sheets / styles / shared strings / relationships などの XML パートで構成されます。
:::

::: info 用語: passthrough part
Formulon が「意味的には所有しないが、保存時に消えないように構造だけ保持する」パートです。エンジンが評価しない機能でも、再計算して保存し直す間にバイト列が消失しません。
:::

## XLSX

OOXML reader / writer は以下を扱います。

- workbook パートと relationships
- worksheets（セル、数式、キャッシュ値）
- styles、number formats、fonts、fills、borders、themes
- shared strings
- tables、defined names
- comments / threaded comments
- hyperlinks
- merges
- data validations
- conditional formatting
- pivot tables / pivot caches
- external links
- ふりがな注釈（run ごとの UTF-16 span と `phoneticPr` の表示プロパティを含む）
- protection metadata
- sheet view、freeze panes、hidden tabs
- 行・列単位の上書き設定

worksheet の印刷設定は、page setup、余白、print options、print area、print titles、header / footer、手動の行 / 列改ページを typed setter で編集できます。モデル化していない部分には raw XML setter も使えますが、不正な fragment は保存前に拒否します。external-link 数式は package の external-link table に結び付いた index 形式を解決し、`[Book1.xlsx]Sheet1!A1` のようにファイル名だけで書いた参照は解決しません。

::: tip キャッシュ値の扱い
読み込み時、数式セルは数式テキストとファイル内のキャッシュ値の両方を保持します。`recalc()` 後、キャッシュ値はエンジンの計算結果で置き換わり、保存時に「数式と値が整合した」ファイルが書き出されます。
:::

## XLSB

XLSB は styles（`BrtFmt` / `BrtXF`）、行 / 列レイアウト、結合、`date1904`、view / zoom / frozen panes、動的配列メタデータ、対応する tokenized formula をモデル化して出力します。XLSB の pivot cache definition、cache record、pivot table パートは、record encoding が対応済みであれば pivot model へデコードして評価します。未計測の encoding は推測せずスキップします。既存の worksheet tail（条件付き書式、入力規則、ハイパーリンク、auto-filter、印刷設定 / 改ページ、drawing / table 参照と relationship）はバイト列のまま保持します。保持されることは編集・評価できることを意味しません。非対応数式はキャッシュ済みリテラルへ置き換える場合があり、`saveWithDiagnostics(WorkbookFormat.Xlsb)` の `downgradedFormulaCount`（Python では `save_with_diagnostics(WorkbookFormat.XLSB)` の `downgraded_formula_count`）で件数を確認できます。

| XLSB の機能 | 現在の挙動 |
| --- | --- |
| Styles（`BrtFmt` / `BrtXF`） | モデル化して出力 |
| 行 / 列レイアウト、結合 | モデル化して出力 |
| `date1904`、view / zoom / frozen panes | モデル化して出力 |
| 動的配列メタデータと対応する tokenized formula | モデル化して出力 |
| Pivot cache / PivotTable パート | 対応する record encoding は評価。未計測の encoding はスキップ |
| worksheet tail と relationship | バイト列のまま保持。編集・評価はしない |
| 非対応数式 | キャッシュ済みリテラルへ置き換える場合があり、件数を報告 |

worksheet tail の保持から comment や pivot の保存を推測しないでください。これらが重要な場合は、入力ファイルを保持したうえで出力パッケージを確認してください。

保存時のコンテナ形式は明示的です。`saveAs(format)` / `save_as(fmt)` は `WorkbookFormat` を受け取って XLSB か XLSX かを選べます。`saveWithDiagnostics(format)` / `save_with_diagnostics(fmt)` も同じ形式指定を使い、パッケージ損失の一部を対象とするカウンターを返します。`readDiagnostics()` / `read_diagnostics()` では読み込み時に取得したカウンターを確認できます。CLI は `-o` パスの拡張子から出力形式を判断します（`-o out.xlsb` は MS-XLSB を書き出し、それ以外は OOXML を書き出します）。一方、読み込みはバイト列の中身を見て判定します。`loadBytes()` / `Workbook.load()` はバイト列そのもの（ZIP シグネチャか BIFF12 レコードストリームか）から XLSX / XLSB を判別するため、拡張子が一致していない `.xlsb` ペイロードでも正しく読み込めます。

下のパネルでは、1 つのワークブックを両方のコンテナに書き出し、生成したバイト列をファイル名なしでそのまま `loadBytes()` に戻しています。カウンターはその書き出しについて `saveWithDiagnostics()` が返した値そのままです。すべて 0 のパネルは「上に挙げた損失が起きなかった」という意味であり、確認していないという意味ではありません。手元のワークブックを読み込ませると、カウンターが動く様子も確認できます。

<FormatDemo />

## 保持と評価の対応

<DiagramLayers :layers="[
  { title: '入力', nodes: ['*.xlsx / *.xlsb バイト列'] },
  { title: '読み込み', nodes: ['Reader'] },
  { nodes: [
      { label: '評価対象パート', note: 'cells・formulas・defined names・tables・条件付き書式の subset' },
      { label: 'Passthrough パート', note: 'charts・drawings・form controls・VBA' }
    ] },
  { nodes: [
      { label: 'エンジンで再計算' },
      { label: 'バイト列のまま保持' }
    ] },
  { title: '書き出し', nodes: ['Writer'] },
  { title: '出力', nodes: ['*.xlsx / *.xlsb バイト列'] }
]" label="読み込みは評価対象パート（再計算される）と passthrough パート（バイト列のまま保持される）に分かれ、どちらも Writer で合流する" />

| 機能 | 読み込み | 再計算 | 書き出し |
| --- | --- | --- | --- |
| セル内の数式 | yes | yes | yes |
| Styles / number formats | yes | n/a | yes |
| Defined names / tables | yes | yes（参照として解決） | yes |
| 条件付き書式 | yes | partial（評価対象 subset） | yes |
| Pivot tables | layout / cache | no | yes |
| Chart | パートを保持 | no | yes |
| Form controls / drawings | passthrough | no | yes |
| VBA project | passthrough | 実行しない | yes |

::: warning VBA は保持するが実行はしない
VBA を含むワークブックは読み込み後に保存し直せますが、マクロは決して実行されません。マクロ側の状態に依存する計算は Excel と差分が出ます。
:::

## 非対応

- 旧 `.xls`（BIFF）の読み書き
- CSV はシンプルな取り込みのみ。Excel CSV の引用符の細かな境界には対応しない
- ライブ外部接続（PowerQuery / OLE DB / Web）

## 次に読むもの

- [ライフサイクル](/ja/workbook/lifecycle) ─ バイト列からワークブックモデルへの変換
- [ワークブック操作](/ja/workbook/operations) ─ sheet / cell / 構造の編集
- [互換性 / ファイル形式サポート](/ja/compatibility/file-format-support) ─ read / write / preserve の対応表
