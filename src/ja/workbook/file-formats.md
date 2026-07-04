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
- protection metadata
- sheet view、freeze panes、hidden tabs
- 行・列単位の上書き設定

::: tip キャッシュ値の扱い
読み込み時、数式セルは数式テキストとファイル内のキャッシュ値の両方を保持します。`recalc()` 後、キャッシュ値はエンジンの計算結果で置き換わり、保存時に「数式と値が整合した」ファイルが書き出されます。
:::

## XLSB

MS-XLSB の読み書きを必要とするワークフローのために、同じ計算モデルを維持したまま使えるバイナリ形式の経路を用意しています。v0.9.3 の時点で、styles（`BrtFmt` / `BrtXF`）、workbook スコープの defined names（future function や `LET` を含む数式も）、cross-sheet 3-D references、dynamic-array のスピル数式（`BrtArrFmla`）はすべて XLSB を往復保存できます — これらの一部は以前、実際の Excel では開けない `.xlsb` を生成していました。array-constant literals は数値要素のみに限定されたままです。文字列 / 真偽値 / エラーの array-constant 要素は認識はされますが decode されず、黙って誤変換されるのではなく明示的なエラーとして表面化します。

| XLSB の機能 | v0.9.3 より前 | v0.9.3 以降 |
| --- | --- | --- |
| Styles（`BrtFmt` / `BrtXF`） | 制限あり | 往復保存できる |
| Cross-sheet 3-D references | 制限あり | 往復保存できる |
| Workbook スコープの names、future function、`LET` | 制限あり | 往復保存できる |
| Dynamic-array のスピル数式（`BrtArrFmla`） | 制限あり | 往復保存できる |
| Array-constant literals | 数値要素のみ | 引き続き数値要素のみ |

条件付き書式、pivot table、comment、data validation は引き続き OOXML 専用です — XLSB の reader / writer にはこれらのパートを扱うレコード処理自体がなく、バージョンによらず対象外です。これらの機能を使うワークブックを XLSB で往復保存すると、エラーにはならず機能が黙って失われます。機能を保持したい場合は XLSX のままにしてください。

保存時のコンテナ形式は明示的です。`saveEx()` / `save_ex()` は `WorkbookFormat` を受け取って XLSB か XLSX かを選べます。CLI は `-o` パスの拡張子から同じ判断をします（`-o out.xlsb` は MS-XLSB を書き出し、それ以外は OOXML を書き出します）。一方、読み込みはバイト列の中身を見て判定します。`loadBytes()` / `Workbook.load()` はバイト列そのもの（ZIP シグネチャか BIFF12 レコードストリームか）から XLSX / XLSB を判別するため、拡張子が一致していない `.xlsb` ペイロードでも正しく読み込めます。

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
