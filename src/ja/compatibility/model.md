# 互換性モデル

Formulon は互換性を *測定可能な性質* として扱います。一般的な「Excel-compatible」と広く言い切るのではなく、Oracle データに裏付けられた **名前付きプロファイル** に対する互換性として説明します。やるべきことは 2 つに分かれます。プロファイルごとの Oracle データ取得と、受け入れ済み差分の明示です。

::: info 用語: measured compatibility（測定可能な互換性）
プロファイルと、それを裏付ける Oracle データ群を指す互換性の説明です。「`win-365-ja_JP` と互換」は *その Excel で実際に動かして値を取得した* ことを意味します。プロファイルを指定しない「Excel-compatible」という言い回しは意図的に避けます。
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

## 差分（divergences）

避けられない差分があります。

- プラットフォーム間の浮動小数ドリフト
- 揮発性関数の取得時刻の差
- 未文書の Excel 挙動で、ビルドをまたぐと安定しないもの
- Excel 通りに揃えるとエンジンの予測可能性が落ちる境界ケースの意図的な是正（暗黙オーバーフロー・暗黙型変換など）

受け入れ済み差分は理由と *最後に検証した Excel ビルド* を付けて記録し、将来 Excel 側で挙動が変わっても判断できるようにします。

## 運用ルール

| 立場 | やること |
| --- | --- |
| Formulon を使うアプリ | 計算に使ったプロファイルを永続化する |
| テスト | 期待するプロファイルと Formulon バージョンを明示する |
| ドキュメント | プロファイル未指定の「Excel-compatible」という曖昧な表現は避ける |
| Issue 報告 | プロファイル、Formulon バージョン、Oracle の Excel ビルド、最小再現ワークブックを含める |

## 次に読むもの

- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ プロファイル一覧
- [テキスト照合](/ja/compatibility/text-collation) ─ 比較、並べ替え、検索の強度
- [ワークブックの言語](/ja/workbook/language) ─ 数式テキストと関数名のローカライズ
- [セルの言語切り替え](/ja/cell/language-switching) ─ エディター言語の実行時切り替え
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ プロファイルをどう検証するか
- [対象外の機能](/ja/compatibility/non-goals) ─ 互換性が意図的にカバーしない範囲
