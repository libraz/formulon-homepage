# 高度な Workbook API

専用の MCP ツールで一般的なワークブック操作を行えます。インストール済み Formulon の `Workbook` クラスに専用ツールがない機能は、`formulon_workbook_api` と `formulon_workbook_call` で扱えます。API カタログはサーバーが実際に読み込んだパッケージから作られ、シグネチャ、ドキュメント、読み書き区分、参照する TypeScript 宣言を含みます。先にメソッドを調べ、インストール済みのシグネチャに合わせて呼び出してください。

## 検索、説明、呼び出し

メソッド名、シグネチャ、ソースドキュメントを検索します。

```json
{
  "name": "formulon_workbook_api",
  "arguments": {
    "operation": "search",
    "query": "pivotLayout",
    "limit": 20,
    "offset": 0
  }
}
```

検索結果には読み込んだエンジンの `version`、操作名、`total`、`count`、`truncated`、`methods` が入ります。`limit` の既定値は 20、上限は 100 です。`offset` は 0 始まりです。`query` はメソッド名、シグネチャ、ドキュメントへの大文字小文字を区別しない部分一致です。

`describe` で対象メソッドの説明を取得し、位置引数を組み立てます。

```json
{
  "name": "formulon_workbook_api",
  "arguments": {
    "operation": "describe",
    "method": "createTable"
  }
}
```

応答には 1 つのメソッドと `declarations` が入ります。宣言には参照レコードと列挙型のソース説明および TypeScript 宣言が含まれます。宣言数、参照深度、文字数に上限があり、結果が途中で切れた場合は `declarationsTruncated` と `truncation` で示します。メソッドの引数順と列挙値は、この応答を基準にしてください。

先に `formulon_open_workbook` に `{ "sessionId": "work" }` を渡してセッションを開きます。そのセッションに対して、位置引数の JSON 配列で呼び出します。

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "addMerge",
    "args": [
      0,
      { "firstRow": 0, "firstCol": 0, "lastRow": 0, "lastCol": 3 }
    ]
  }
}
```

`args` の既定値は空配列です。MCP ツールは引数順を変換せず、既定値を補わず、オブジェクトをレコードへ変換しません。サーバーの許可リストにないメソッド、または読み込んだワークブックで呼び出せないメソッドは呼び出し時に失敗します。引数を作る前にライブカタログを調べてください。

実用的なプロンプトは次のようになります。

> インストール済み Workbook API から現在のシート表示を読むメソッドを探してください。説明を取得し、シート番号 0 に対して呼び出し、ワークブックは変更しないで結果を返してください。

エージェントは `getSheetView` を検索し、説明を取得してから発見した引数で呼び出します。TypeScript のレコードや列挙値が変わっても、古い手書き引数を送らずに済みます。

## 許可されるメソッド

サーバーの許可リストは明示的です。次のグループを含みます。

- シートの作成、削除、名前変更、移動、値、数式、セルメタデータ、定義名、行列の挿入、ワークシート寸法
- 計算、部分再計算、並列再計算、計算モード、反復計算、数式評価、依存関係グラフ、スピル情報（動的配列の展開範囲）、関数名とメタデータ
- ワークブック時計の固定、Excel プロファイル、読み込み診断、ページネーション、ページ設定、余白、印刷オプション、ヘッダー・フッター、印刷範囲、印刷タイトル、手動改ページ
- ワークシートテーブル、AutoFilter、ピボットキャッシュ、ピボットテーブル、フィールド軸と順序、データフィールド、フィルター、日付グループ、ネイティブピボットテーブルのレイアウト
- シート表示、保護、グリッド線、表示フラグ
- フォント、塗りつぶし、罫線、表示形式、セルスタイル、差分書式、セル XF、範囲 XF
- 結合、コメント、ハイパーリンク、入力規則、条件付き書式、ふりがな、外部リンク

`save`、`saveAs`、`saveWithDiagnostics` はセッション管理を迂回するため許可されません。保存は `outputPath` を明示した `formulon_save_session` を使います。`delete`、`isValid`、JavaScript コールバックを受け取る `setIterativeProgress` も JSON 呼び出しには適さないため許可されません。

## 応答エンベロープ

`formulon_workbook_call` は `{session,method,result}` を返します。次の例は応答全体ではなく、内側の `result` の内容です。エンジンの `status` フィールドを保持します。取得メソッドでは次の形を使います。

```json
{
  "status": { "ok": true, "status": 0, "message": "", "context": "" },
  "value": 3
}
```

```json
{
  "status": { "ok": true, "status": 0, "message": "", "context": "" },
  "items": [
    { "name": "Sheet1", "index": 0 }
  ]
}
```

`status` の後に続くフィールドは発見したメソッドに従います。数値や文字列の取得メソッドは `value`、一覧は `items`、`pinnedNow`、`readDiagnostics`、ピボットテーブルのレイアウトなどは固有フィールドを返します。ネイティブの値は `{kind, value}` またはエラーエンベロープになります。`ok` でない `status` は空の成功結果ではなく MCP エラーになります。

読み取り専用区分はサーバーが明示的に管理します。読み取り専用呼び出しは変更あり（dirty）の状態を変えません。それ以外の許可メソッドは、エラー報告前にネイティブ状態が変わる可能性があるため、呼び出し前にセッションを変更あり（dirty）にします。変更に失敗した場合はセッションを調べ、対象範囲を読み取ってください。

## ワークブック時計を固定する

時刻依存の数式と相対期間のピボットテーブルフィルターを同じ瞬間で評価するには、`[year, month, day, hour, minute, second]` の 6 つの位置引数で時計を固定します。

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "setPinnedNow",
    "args": [2026, 10, 1, 9, 30, 0]
  }
}
```

以降の `NOW()`、`TODAY()`、相対期間フィルターの評価は固定時刻を参照します。`setPinnedNow` は既存の数式キャッシュを再計算しません。セルを読む前に `formulon_recalc_session` を呼んでください。固定を解除した後も、キャッシュをホスト時計に合わせるには再計算が必要です。`pinnedNow` で読み取り、`clearPinnedNow` でホスト時計へ戻します。

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "pinnedNow",
    "args": []
  }
}
```

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "clearPinnedNow",
    "args": []
  }
}
```

固定値はインメモリのモデルにだけ存在し、保存されません。別プロセスでも同じ瞬間を使う場合は、セッションを開いた後に再度設定してください。

## 再計算と WASM ランタイム

サーバーは Formulon の既定の単一スレッド WASM モジュールを読み込みます。`recalcParallel` は API 互換性のため許可されていますが、このランタイムでは直列に評価され、`result.stats.workerThreadsStarted: 0` を返します。通常の再計算には専用の `formulon_recalc_session` を使い、発見したメソッドの結果やオプションが必要な場合だけ `recalcParallel` を使います。

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "recalcParallel",
    "args": [0]
  }
}
```

この呼び出しは、低レベルの変更系計算と同じくセッションを変更あり（dirty）にします。`result.status` はエンジン呼び出しの結果を示しますが、業務ルールの正しさは示しません。

## 低レベル API の注意点

### PivotCache とワークシートのソース

低レベル API で作った PivotCache は、保存前に `pivotCacheSetWorksheetSource` でワークシートのソースへ接続してください。ソース宣言のないキャッシュは Excel の修復対象になる場合があります。`formulon_create_pivot` はこの手順と範囲検証を実行します。

### ピボットテーブルのフィールド順

フィールドの軸を設定するだけでは、グループ化したフィールド順は設定されません。`pivotFieldSetAxis` を使う場合は `pivotSetRowFieldOrder` と `pivotSetColFieldOrder` も呼び出します。高レベルのピボットテーブルツールは両方を実行します。

### ピボットテーブルの表示形式

低レベルのピボットフィールドとデータフィールドは、Excel の書式コードではなく 10 進数の `numFmtId` 文字列を受け取ります。カスタムコードは `addNumFmt` で登録し、返された ID を文字列で渡します。組み込み ID の `"4"` などを使える場合もあります。高レベルのピボットテーブルツールは書式コードを受け付けて ID を登録します。

### 印刷と表示の生の XML を扱う API

低レベル経路では、ページ設定 XML、シート表示フラグ、保護、ページネーションを扱えます。XML 断片や列挙値を渡す前に、正確な宣言を調べてください。一般的なレイアウトには `formulon_print_settings`、`formulon_apply_layout`、`formulon_preview_range` の型付き経路を使います。

### 高度な呼び出し後の保存

低レベル呼び出しはファイルを書き込みません。返された `status` と変更対象を確認してから、セッション API で明示的な保存先へ保存します。保存先の `out` ディレクトリは、先にホスト側で作成してください。保存ツールとプレビューツールは親ディレクトリを作成しません。

```json
{
  "name": "formulon_save_session",
  "arguments": {
    "sessionId": "work",
    "outputPath": "out/advanced-result.xlsx"
  }
}
```

保存後は `losses` とセッションの `dirty` を確認してください。ネイティブテーブル、ピボットテーブル、印刷設定、コメントを保持する必要がある場合は `.xlsx` を使います。確認後はセッションを閉じます。

```json
{
  "name": "formulon_close_workbook",
  "arguments": { "sessionId": "work" }
}
```

高レベルの全ツールは [ツールリファレンス](/ja/mcp/tools)、セッションの流れとエラーは [ワークフロー](/ja/mcp/workflow) を参照してください。
