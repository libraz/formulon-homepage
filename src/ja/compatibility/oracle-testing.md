# Oracle テスト

Oracle テストは、実際の Excel から取得した値と Formulon の値を比較するものです。互換性の根拠になる実証層であり、ドキュメント上の仕様ではなく、対象ワークブックとロケールで *Excel が実際に何を返すか* を基準にします。

::: info 用語: Oracle データ
既知のワークブック・プロファイル・Excel ビルドに対して、Excel が返した値を取得したもの。テストはそのワークブックを Formulon で再計算し、取得済みの値と比較します。食い違ったときは *Excel* を正とします。
:::

::: info 用語: 受け入れ済み差分（accepted divergence）
Formulon が意図的に Excel と違う挙動をするケースです。理由（セキュリティ、決定論的な挙動、Excel 側の不具合修正など）と、最後に確認した Excel ビルドを記録します。「Excel 風」とぼかさず、明示的に管理します。
:::

## 現在の結果

各 Oracle トラックの現状です。いずれもチェックイン済みのゴールデンデータに対してスイートが報告している値であり、目標値ではありません。

| トラック | 結果 | 記録済みの skip / divergence | ゴールデンの出所 |
| --- | --- | --- | --- |
| 主要な数式 Oracle | `4423/4423` pass | skip `125` 件（記録済み） | Mac Excel 365 ja-JP（`mac-365-ja_JP`） |
| 条件付き書式 Oracle | `23/23` pass | — | Mac Excel 365 ja-JP（`mac-365-ja_JP`） |
| 他エンジン由来コーパス（クロスチェック） | `12510/12510` pass | divergence `168` 件 | 他エンジン。Excel ではない |
| ワークブック Oracle（ピボット + 印刷） | `66/66` pass | skip `10` 件（記録済み） | 製品版 Windows Microsoft 365 ja-JP で検証済み（`win-365-ja_JP`） |

**103 の Oracle カテゴリ**を定義しています。数式と条件付き書式の track は Mac Excel 365 ja-JP、workbook track は Windows Excel 365 ja-JP から再生成します。workbook の golden には capture identifier があり、全 suite を単一の検証済み Microsoft 365 セッションに固定します。

カタログ済みの `522` 関数のうち `518` が6つのクロージャ条件（`behaviors_declared` / `cases_cover_behaviors` / `golden_present` / `divergence_documented` / `not_in_pilot` / `behavior_drift`）をすべて満たします。残る4つ（`ARRAYTOTEXT` / `FILTERXML` / `GETPIVOTDATA` / `PHONETIC`）が満たさないのは `behaviors_declared` だけで、未実装ではなく挙動の分類が不足しています。`JIS` は `DBCS` の alias として宣言され、closure 条件を満たします。Excel はこの ja-JP の数式バー表記を保存・評価の前に書き換えるため、`JIS` を直接指定する Oracle ケースは作れません。closure harness は alias 先の関数に解決して判定します。

skip はいずれも明示的な divergence、ホストサービス依存、volatile または環境依存のケース、ドライバの制約のいずれかで、黙って握りつぶしたスタブはありません。それぞれ最後に確認した Excel ビルドを [`tests/divergence.yaml`](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml) に記録しています。

## なぜ Oracle データが必要か

スプレッドシートの挙動には、丸め境界、`TEXT()` のロケール固有の桁表現、`DATEVALUE()` の 2 桁年処理、空値の型変換、結合セルとスピル衝突の相互作用など、未文書の細部が多数あります。コミット済みのゴールデンデータ（`tests/oracle/*/golden`）はそれらをレビュー可能な形に固定し、回帰をデプロイ前、つまり PR の時点で検出できるようにします。

## 失敗をどう読むか

<DiagramFlow :steps="[
  { label: 'Oracle テスト失敗', note: 'Formulon ≠ Excel 取得値' },
  { label: '誤った値か？', note: 'はい → Formulon の不具合: エンジンを修正し、ゴールデンデータを追加' },
  { label: 'Excel ビルドが変わったか？', note: 'はい → プロファイル差分: 再取得して記録' },
  { label: 'NOW / RAND / ネットワークに依存？', note: 'はい → 揮発性のゴールデンデータ: 入力固定で再取得、または volatile として記録' },
  { label: '受け入れ済み差分', note: '理由 + last-verified build を記録' }
]" />

通常、失敗は次のいずれかです。

| 種類 | 意味 | 典型的な対応 |
| --- | --- | --- |
| Formulon の不具合 | エンジンが誤った値を返した | エンジンを修正し、回帰用のゴールデンデータを追加 |
| プロファイル差分 | 対象 Excel ビルドが変わった | ゴールデンデータを再取得し、変更を記録 |
| 揮発性のゴールデンデータ | 取得時に `NOW` / `RAND` / ネットワーク依存を含んでいた | 入力を制御して取り直す、またはそのゴールデンデータを volatile として記録 |
| 受け入れ済み差分 | 意図的に Excel と異なる | 差分リストに理由と最後に確認した Excel ビルドを記録 |

## データの提供

各自の Excel 環境で Oracle データ取得フローを実行し、得られたゴールデンデータを提供すると、検証できるロケールが増えていきます。同じワークブックを `win-365-ja_JP`、`mac-365-ja_JP` など複数のプロファイルで取得すれば、エンジンが検証できる範囲も広がります。取得フローは [Oracle データの提供](/ja/development/oracle-contribution) を参照してください。

数式と条件付き書式のプライマリプロファイルは `mac-365-ja_JP` です。ワークブックトラックのプライマリプロファイルは、製品版 Windows Microsoft 365 で検証した `win-365-ja_JP` です。

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ プロファイル、差分、運用ルール
- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ 現在のプロファイル
- [Oracle データの提供](/ja/development/oracle-contribution) ─ データ追加の流れ
