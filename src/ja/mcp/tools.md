# ツール一覧

`formulon-mcp` が公開する 37 個の全ツールを、目的別にまとめます。モデルが MCP のツール検出で受け取る説明と内容が一致するため、人間がツール群全体を一望したいときに使えます。

::: info A1 と 0-based の併用
A1 表記を使う場合を除き、sheet / row / column インデックスは Formulon API と同じ 0-based です。アドレスを取るツールは両方の形式を受け付けます。
:::

::: warning 単一シートの矩形範囲のみ受け付ける
A1 パーサーが受け付けるのは、単一シート内の矩形範囲（`Sheet1!A1:C10`）だけです。行全体・列全体の参照（`A:A`、`1:1` ─ パターンは列の文字と行の数字の両方を要求します）や、シートをまたぐ 3-D 範囲（`Sheet1:Sheet3!A1:B2`）は拒否されます。Formulon コアは 3-D 参照をサポートしますが、`formulon-mcp` の A1 パーサーは拒否します。行全体・列全体を指定する代わりに、シートの used range（`formulon_inspect_layout`）から矩形範囲を組み立ててください。
:::

<DiagramLayers :layers="[
  { nodes: ['formulon-mcp ツール群'] },
  { nodes: [
      { label: 'エンジン', note: 'version / eval / lookup / trace' },
      { label: 'セッション', note: 'open / list / close / recalc / save / metadata' },
      { label: '検査', note: 'session / layout / regions / analyze' },
      { label: 'セルと範囲', note: 'set / get / range / set-range / find / replace' },
      { label: '構造', note: 'sheet / defined name / insert-delete / view / dimension' },
      { label: 'リッチデータ', note: 'merge / comment / hyperlink / validation / cond-format' },
      { label: '詳細アクセス', note: 'workbook_call / ワンショット inspect & update' }
    ]
  }
]" />

## エンジン

| Tool | 役割 |
| --- | --- |
| `formulon_version` | ロード済み Formulon エンジンと MCP サーバーのバージョンを返す。 |
| `formulon_eval_formula` | 使い捨てワークブックで Excel 数式を 1 つ評価。`sessionId` を渡すと、開いたセッション上で読み取り専用評価する。 |
| `formulon_function_lookup` | 登録済み関数を列挙、メタデータ / ローカライズ名を解決。 |
| `formulon_trace` | あるセルの precedents、dependents、または spill 情報を返す。 |

## セッション

| Tool | 役割 |
| --- | --- |
| `formulon_open_workbook` | `.xlsx` または `.xlsb` のパスを新しいセッションに読み込む。または既定ワークブックを作る。読み込み時にデコードできなかった内容は、セッションの `loadLosses` に報告される。 |
| `formulon_list_sessions` | 開いているセッションを列挙。 |
| `formulon_close_workbook` | セッションを解放。 |
| `formulon_recalc_session` | 開いているセッションに対し再計算を発火。 |
| `formulon_save_session` | セッションをディスクに書き出す（`outputPath` → セッションの直前の保存先 → 元のソースパスの順に解決）。出力パスが `.xlsb` なら XLSB、それ以外は XLSX を選び、`bytes`、選択した `format`、writer が削除・下位変換した内容の `losses` を返す。 |
| `formulon_session_metadata` | セッションの関数名一覧や external link を読む。 |

## 検査

| Tool | 役割 |
| --- | --- |
| `formulon_inspect_session` | sheets、定義名（シートローカルなら `localSheetId` を含む）、tables と、オプションで sparse cell entries を返す。 |
| `formulon_inspect_layout` | シートごとの layout：used range、merge、行・列 override、protection、セル、計算値、数式、style 詳細（オプション）、シートビュー（zoom / freeze pane / hidden 状態）。 |
| `formulon_detect_regions` | テーブル状の領域、label-value ペア、合計セルなどをルールベースの confidence と evidence 付きで検出。 |
| `formulon_analyze_workbook` | invoice / list / report / schedule / form などのワークブック形状を、決定論的な evidence で分類。 |

## セルと範囲

| Tool | 役割 |
| --- | --- |
| `formulon_set_cells` | セッションに mutation を適用。A1（`Sheet1!B2`）または 0-based（`sheet` / `row` / `col`）どちらも可。 |
| `formulon_set_range` | アンカーセルを起点に値の 2D ブロックを書き込む。各要素の JSON 型でセル型が決まり、`{"f":"=…"}` は数式、`null` はそのセルをスキップ。テーブルには `set_cells` より簡潔。 |
| `formulon_get_cell` | 1 セルを読む。セッションからでも、パス直接でも可。 |
| `formulon_get_range` | セッションから A1 矩形範囲を読む。 |
| `formulon_find_cells` | テキスト値・数式テキストを検索。 |
| `formulon_replace_cells` | 一致したテキスト値・数式テキストを置換。 |

## ワークブック構造

| Tool | 役割 |
| --- | --- |
| `formulon_sheet_operation` | シートの追加 / 削除 / 改名 / 移動。 |
| `formulon_set_defined_name` | 定義名を追加 / 置換 / 削除。`sheet` を省略するとワークブック全体、渡すとシートローカルになる。Excel が `_xlnm.Print_Area` と `_xlnm.Print_Titles` を適用するにはシートローカルでなければならない。 |
| `formulon_edit_structure` | 行・列の挿入 / 削除。 |
| `formulon_dimension_operation` | 列幅・行高の override を一覧、または width / height、hidden、outline level を設定。列は境界を含む `[first, last]` の範囲、行は単一の行インデックスに作用。 |
| `formulon_set_sheet_view` | zoom、freeze pane、タブの hidden 状態を設定。 |
| `formulon_default_font` | ワークブックの既定フォントを取得または置換します。書式未設定セルはフォントスロット `0` を使います。 |
| `formulon_build_document` | 名前付きブロックから見出し・表・集計を配置し、セル、書式、罫線、幅、結合、印刷範囲をまとめて決定します。 |
| `formulon_style_range` | A1 範囲にフォント、塗りつぶし、罫線、表示形式、配置の差分を適用します。 |
| `formulon_print_settings` | ページ設定、余白、印刷オプション、ヘッダー/フッター、印刷範囲・タイトル、手動改ページを取得または設定します。 |

## リッチデータ

| Tool | 役割 |
| --- | --- |
| `formulon_merge_operation` | 結合範囲の一覧 / 追加 / 削除 / クリア。 |
| `formulon_comment_operation` | セルコメントの取得 / 設定 / 削除。 |
| `formulon_hyperlink_operation` | ハイパーリンクの一覧 / 追加 / 削除 / クリア。追加は `lastRow` / `lastCol` までの境界を含む矩形にでき、`target` を空にして `location` を渡すとワークブック内へのリンクになる。 |
| `formulon_validation_operation` | データ検証の一覧 / 追加 / 削除 / クリア。 |
| `formulon_conditional_format_operation` | 条件付き書式の一覧 / 追加 / 削除 / クリア / 評価。 |

## 詳細アクセス

| Tool | 役割 |
| --- | --- |
| `formulon_workbook_call` | 許可リストに登録された Formulon `Workbook` API への低レベルアクセス。 |
| `formulon_inspect_workbook` | パスからのワンショット要約。 |
| `formulon_update_workbook` | ワンショットの load / create → mutate → recalc → save。`bytes` とともに、選択した `format` と writer の `losses` を返す。 |

::: warning `workbook_call` は許可リスト経由で、任意呼び出しではない
`formulon_workbook_call` はサーバー側の許可リストに載っているメソッドだけを呼び出します（詳しくは [セキュリティモデル](/ja/mcp/security)）。許可リスト外は入力形によらず拒否されます。PivotTable / PivotCache、ワークシート table と AutoFilter、style と differential format、シートの表示・ページレイアウトビュー、ふりがな、ページネーション、依存関係グラフ照会、関数メタデータ、spill 情報、ワークブック時計の固定など、上位ツールがまだカバーしていない範囲のためにあります。

`setPinnedNow` は in-memory のモデル状態だけを変え、保存しても固定値は残りません。時刻依存の数式への影響は[再計算](/ja/workbook/recalculation)を参照してください。API から作成した PivotCache は、保存前に `pivotCacheSetWorksheetSource` も必要です。[PivotTable](/ja/workbook/pivots)を参照してください。
:::

## 次に読むもの

- [ワークフロー](/ja/mcp/workflow) ─ 基本ループ
- [セキュリティモデル](/ja/mcp/security) ─ サーバーが拒否すること
