# 互換性モデル

Formulon は互換性を *測定できる性質* として扱います。漠然と「Excel 互換」と言い切るのではなく、Oracle データに裏付けられた名前付きプロファイルに対する互換性として説明します。そのためにやることは 2 つです。プロファイルごとに Oracle データを取得することと、受け入れ済み差分を明示することです。

::: info 用語: 実測に基づく互換性
プロファイルと、それを裏付ける Oracle データ群を示した互換性の説明です。「`win-365-ja_JP` と互換」は *その Excel で実際に動かして値を取得した* ことを意味します。プロファイルを指定しない「Excel 互換」という言い回しは意図的に使いません。
:::

プロファイルの取得は、実機の Excel から再利用可能なデータセットへの一方向パイプラインです。

<DiagramFlow :steps="[
  { label: 'Excel build', note: '例: Win 365 ja-JP' },
  { label: 'Oracle データ', note: '取得' },
  { label: '互換性プロファイル', note: 'win-365-ja_JP ─ 検証済み' }
]" />

Oracle テストでは、検証用ワークブックを再計算し、Excel から取得した期待値と比較します。通常の API 呼び出しが期待値との比較を自動で行うわけではありません。

<DiagramLayers :layers="[
  { title: 'テスト入力', nodes: ['検証用ワークブック', '互換性プロファイル'] },
  { nodes: ['Formulon エンジン'] },
  { nodes: ['計算値'] },
  { title: 'Oracle テストで比較', nodes: [
    { label: '差分なし', note: 'プロファイル互換が成立' },
    { label: '追跡済みの差分', note: '理由 + last-verified build' },
    { label: '未追跡の差分', note: 'バグ ─ 修正または文書化' }
  ] }
]" />

## プロファイル

Formulon のプロファイルは `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}` の 28 種類で、既定は `win-365-en_US` です。14 個の Mac プロファイルは、CI のゲートになる Mac Excel 365 の数式 Oracle で実測しています。`mac-365-ja_JP` が主プロファイルで、ほかの 13 ロケールにも専用ゴールデンがあります。`win-365-ja_JP` は Windows で実測したワークブック Oracle のプロファイルで、ほかの 13 個の Windows プロファイルは Mac の取得結果と測定済みの Mac / Windows ホスト差から推定しています。

公開リストと固定方法は [ロケールプロファイル](/ja/compatibility/locale-profiles) を参照してください。

## 差分

数値の丸め、型変換、数式の入力規則など、同じ入力から同じ答えを得られる差分は、実測値を根拠に実装を修正します。プラットフォーム間の浮動小数点差を一律の許容誤差で処理することはありません。

差分レジストリには、意図的に異なる動作のほか、Excel が再現可能な値を返さないケース、取得ツールの制約、未解決の実装差分も記録します。各項目の `cause`、対象プロファイル、理由、最後に確認した Excel ビルドを確認してください。`mode: skip-oracle` は比較を実行しない指定であり、一致を確認したことにはなりません。許容誤差付きで比較するケースも、その範囲での一致を示します。

反復計算を無効にした複数セルの循環参照は、入力順序を保存ファイルから復元できないため `#REF!` を返します。自分自身だけを巡る循環は Excel と同じく 0 です。配列のメモリ上限や外部サービスにも境界があります。具体例は [Excel 互換の到達点](/ja/compatibility/edge-cases)、分類と合格条件は [Oracle テスト](/ja/compatibility/oracle-testing)を参照してください。

## 運用ルール

| 立場 | やること |
| --- | --- |
| Formulon を使うアプリ | 計算に使ったプロファイルを永続化する |
| テスト | 期待するプロファイルと Formulon バージョンを明示する |
| ドキュメント | 1 つのプロファイルでしか検証していない機能に、プロファイル抜きの「Excel 互換」という表現を使わない |
| Issue 報告 | プロファイル、Formulon バージョン、Oracle の Excel ビルド、最小再現ワークブックを含める |

## 次に読むもの

- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ プロファイル一覧
- [テキスト照合](/ja/compatibility/text-collation) ─ 比較、並べ替え、検索の強度
- [ワークブックの言語](/ja/workbook/language) ─ 数式テキストと関数名のローカライズ
- [セルの言語切り替え](/ja/cell/language-switching) ─ エディター言語の実行時切り替え
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ プロファイルをどう検証するか
- [対象外の機能](/ja/compatibility/non-goals) ─ 互換性が意図的にカバーしない範囲
