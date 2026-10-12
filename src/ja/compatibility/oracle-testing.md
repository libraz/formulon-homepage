# Oracle テスト

Oracle テストは、実際の Excel から取得した値と Formulon の値を比較するものです。互換性の根拠になる実証層であり、ドキュメント上の仕様ではなく、対象ワークブックとロケールで *Excel が実際に何を返すか* を基準にします。

::: info 用語: Oracle データ
既知のワークブック・プロファイル・Excel ビルドに対して、Excel が返した値を取得したもの。テストはそのワークブックを Formulon で再計算し、取得済みの値と比較します。食い違ったときは *Excel* を正とします。
:::

::: info 用語: 受け入れ済み差分（accepted divergence）
Formulon が意図的に Excel と違う挙動をするケースです。理由（セキュリティ、決定論的な挙動、Excel 側の不具合修正など）と、最後に確認した Excel ビルドを記録します。「Excel 風」とぼかさず、明示的に管理します。
:::

## 検証の種類

Oracle の検証は、数式、条件付き書式、他エンジンとの照合、ワークブック構造のトラックに分かれています。表は各トラックの対象と取得元を示します。現在の合格数やスキップ数は、下のソース検証を実行して確認してください。

| トラック | 対象 | ゴールデンの出所 |
| --- | --- | --- |
| 主要な数式 Oracle | 数式セルの値 | Mac Excel 365 ja-JP（`mac-365-ja_JP`） |
| ロケール別の数式 Oracle | ロケールごとの数式セルの値 | 14 ロケールすべての Mac Excel 365（`mac-365-<locale>`） |
| 条件付き書式 Oracle | 条件付き書式の判定と表示結果 | Mac Excel 365 ja-JP（`mac-365-ja_JP`） |
| 他エンジン由来コーパス（クロスチェック） | Excel 以外のエンジンとの照合 | 他エンジン。Excel ではない |
| ワークブック Oracle | ピボットテーブルの構造と印刷レイアウト | Windows 版 Microsoft 365 の Excel（`win-365-ja_JP`） |

数式の検証は 14 ロケールの Mac Excel 365 から再生成します。`mac-365-ja_JP` がプライマリで、残り 13 個は同名のプロファイルに対する独立した Oracle として CI のゲートになります。各ターゲットのゴールデン・`divergence.yaml`・`ENVIRONMENT.md` は `tests/oracle/targets/<target>/` にあり、divergence ファイルの `applies_to` では `mac` というホストトークンを使えます。条件付き書式は Mac Excel 365 ja-JP、ワークブック単位の検証は Windows 版 Microsoft 365 の Excel から再生成します。ワークブックのゴールデンには取得識別子があり、各スイートを検証済み Microsoft 365 セッションに固定します。ワークブックの取得はピボットテーブルと印刷挙動を対象に、WSL2 から Windows の COM へ接続して行います。合格数やスキップ数は取得時点のデータに依存するため、このページでは固定しません。[Formulon のソースチェックアウト](https://github.com/libraz/formulon)でテストバイナリをビルドし、次のスイートを実行してください。

```sh
make build
make oracle-verify
make ironcalc-verify
```

カタログの検証完了条件を確認するメタデータ検査は、エンジンの再計算やスイートの合格数集計とは別です。

```sh
tools/oracle/.venv/bin/python tools/oracle/closure_check.py --report --json
tools/oracle/.venv/bin/python tools/oracle/workbook_closure_check.py
```

カタログ済みの `526` 関数のうち `519` が 6 つの検証完了条件（`behaviors_declared` / `cases_cover_behaviors` / `golden_present` / `divergence_documented` / `not_in_pilot` / `behavior_drift`）をすべて満たします。残る 7 つのうち 4 つ（`ARRAYTOTEXT` / `FILTERXML` / `GETPIVOTDATA` / `PHONETIC`）が満たさないのは `behaviors_declared` だけで、未実装ではなく挙動の分類が不足しています。残り 3 つの `_TRO_ALL` / `_TRO_LEADING` / `_TRO_TRAILING` は、トリム参照演算子 `.:.` / `.:` / `:.` をファイルに保存するときの関数名です。Oracle はこれらの演算子を検証していますが、保存用の関数名を直接書いたケースはないため、検証ツールはこの 3 つにケースを割り当てられません。`JIS` は `DBCS` の別名として宣言され、検証完了条件を満たします。Excel は ja-JP の数式バー表記を保存・評価の前に書き換えるため、`JIS` を直接指定する Oracle ケースは作れません。検証ツールは別名の解決先で判定します。

スキップはいずれも明示的な差分（divergence）、ホストサービス依存、揮発性または環境依存のケース、ドライバの制約のいずれかに分類され、黙って握りつぶしたスタブはありません。差分レジストリに登録したスキップは、理由と最後に確認した Excel ビルドを [`tests/divergence.yaml`](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml) に記録します。ドライバやランナーによるスキップは、ゴールデンデータ、機能メタデータ、実行結果を別途確認します。

ワークブック track のスキップの大半は同じ Excel の癖によるものです。印刷倍率やズームが 50% 以下のとき、Excel の改ページプレビューは幾何的なページ分割に従わない列方向の自動改ページを出すため、観測される改ページの集合は倍率を下げても減らなくなり、25% で再び増えます。該当するケースには、測定に使った Microsoft 365 での観測結果を記録しています。

## なぜ Oracle データが必要か

スプレッドシートの挙動には、丸め境界、`TEXT()` のロケール固有の桁表現、`DATEVALUE()` の 2 桁年処理、空値の型変換、結合セルとスピル衝突の相互作用など、未文書の細部が多数あります。コミット済みのゴールデンデータ（`tests/oracle/*/golden`）はそれらをレビュー可能な形に固定し、回帰をデプロイ前、つまり PR の時点で検出できるようにします。

## 失敗をどう読むか

<DiagramFlow :steps="[
  { label: 'Oracle テスト失敗', note: 'Formulon ≠ Excel 取得値' },
  { label: '誤った値か？', note: 'はい → Formulon の不具合: エンジンを修正し、ゴールデンデータを追加' },
  { label: 'Excel ビルドが変わったか？', note: 'はい → プロファイル差分: 再取得して記録' },
  { label: 'NOW / RAND / ネットワークに依存？', note: 'はい → 揮発性のゴールデンデータ: 入力固定で再取得、または揮発性として記録' },
  { label: '受け入れ済み差分', note: '理由 + 最後に確認したビルドを記録' }
]" />

通常、失敗は次のいずれかです。

| 種類 | 意味 | 典型的な対応 |
| --- | --- | --- |
| Formulon の不具合 | エンジンが誤った値を返した | エンジンを修正し、回帰用のゴールデンデータを追加 |
| プロファイル差分 | 対象 Excel ビルドが変わった | ゴールデンデータを再取得し、変更を記録 |
| 揮発性のゴールデンデータ | 取得時に `NOW` / `RAND` / ネットワーク依存を含んでいた | 入力を制御して取り直す、またはそのゴールデンデータを揮発性として記録 |
| 受け入れ済み差分 | 意図的に Excel と異なる | 差分リストに理由と最後に確認した Excel ビルドを記録 |

## データの提供

各自の Excel 環境で Oracle データ取得フローを実行し、得られたゴールデンデータを提供すると、検証できるロケールが増えていきます。`win-365-ja_JP` 以外の Windows プロファイルは Mac での取得結果からの推定なので、残り 13 ロケールの実際の Windows 環境で取得したゴールデンデータが最も役立ちます。取得フローは [Oracle データの提供](/ja/development/oracle-contribution) を参照してください。

数式と条件付き書式の主プロファイルは `mac-365-ja_JP` で、ほかの 13 個の Mac ロケールはそれぞれ専用のゴールデンで検証します。ワークブック検証の主プロファイルは、製品版 Windows Microsoft 365 で検証した `win-365-ja_JP` です。

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ プロファイル、差分、運用ルール
- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ 現在のプロファイル
- [テキスト照合](/ja/compatibility/text-collation) ─ プロファイルごとの文字順をどう測定するか
- [Oracle データの提供](/ja/development/oracle-contribution) ─ データ追加の流れ
