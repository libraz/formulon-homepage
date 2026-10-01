# Oracle データの提供

Oracle データは検証済みの互換性を広げる主な手段です。生成では実際の Excel を操作し、検証ではコミット済みの正解値（ゴールデンデータ）を読むため、CI でも安全に実行できます。

::: info 用語: Oracle データの生成と検証
生成は実際の Excel に対して取得ツールを実行し、Excel で取得した正解値（ゴールデンデータ）を JSON に書き出す処理です。Excel を持つコントリビュータのマシンでだけ実行します。検証はコミット済みのゴールデンデータと Formulon の出力を比較します。Excel は不要で、CI でも安全に実行できます。
:::

::: warning Microsoft 365 限定
Oracle データは **Excel 365**（Microsoft 365 サブスクリプション）から取得する必要があります。Office 2019 以前はサポート対象外です ─ `ARRAYTOTEXT`、`LAMBDA`、動的配列系関数（`SORT` / `FILTER` / `UNIQUE` / `XLOOKUP` など）は Office 2019 より後に追加された関数で、Office 2019 では警告なしに `#NAME?` を返します。その値を記録すると、誤った値が参照データになります。3 つの生成コマンド（`oracle-gen` / `oracle-gen-cf` / `oracle-gen-workbook`）は起動時に `=ARRAYTOTEXT(1)` を評価し、Excel が認識しなければ明確なエラーで生成を中止します。
:::

<DiagramLayers :layers="[
  { title: 'コントリビュータ環境', nodes: ['実 Excel 365（ロケール別ビルド）'] },
  { title: '生成', nodes: ['make oracle-contribute / oracle-gen[-cf|-workbook]'] },
  { title: '取得', nodes: ['ゴールデン JSON + Excel ビルド・OS・ロケールのメタデータ'] },
  { title: 'レビュー', nodes: ['Pull request'] },
  { title: 'CI', nodes: [{ label: 'make oracle-verify', note: 'Excel 不要' }] },
  { title: '比較', nodes: ['Formulon エンジン vs 取得済みゴールデン'] },
  { title: '結果', nodes: ['互換性を確認', 'Oracle テストのフローで調査'] }
]" />

## 提供フロー

1. 提供対象ロケールの Excel 365 を用意します。
2. リポジトリルートで `make oracle-contribute` を実行します。
3. 生成されたゴールデンデータとメタデータを確認します。
4. データを含む pull request を出します。

各提供データには OS・Excel ビルド・ロケール・プロファイル識別子を含めてください。後からゴールデンデータと Formulon が食い違ったときに、どの Excel ビルドで取り直すべきかをメタデータから確認できます。

## ターゲット

ターゲット名は `<host>-<excel-major>-<locale>` の形式です（例: `mac-365-ja_JP` / `win-365-ja_JP`）。ターゲット一覧は `tools/oracle/targets.yaml` にあります。

現在募集中のロケールは英語・ドイツ語・フランス語・中国語・韓国語・タイ語の Excel 環境です。これらのターゲットを 1 つでも提供すると、推測ではなく実測のロケール挙動を確認できる範囲が広がります。

::: tip 提供範囲は完全でなくてよい
全関数を網羅する必要はありません。1 ロケールの 1 関数族（テキスト / 日付 / 検索など）を対象にしたゴールデンデータでも、互換性を確認できる範囲が広がります。
:::

## コマンド

```sh
make oracle-setup
make oracle-contribute
make oracle-contribute TARGET=mac-365-en_US
make oracle-gen TARGET=win-365-ja_JP SUITE=count
make oracle-gen-cf SUITE=<category>
make oracle-gen-workbook TARGET=<name> SUITE=<category>
make oracle-verify
```

`make oracle-verify` は CI で動きます。それ以外は Excel が必要で、コントリビュータのマシンでだけ実行します。`oracle-gen` は数式のゴールデンを扱い、`oracle-gen-cf` は条件付き書式の検証系統（macOS 限定）を、`oracle-gen-workbook` はピボットテーブル / 印刷範囲の検証系統を扱います（`TARGET` を省略するとホスト OS から自動判定されます）。

### ワークブック検証対象の取り込み

新しいワークブック検証ターゲットのデータは、取得元情報と正解値を確認するまでリポジトリ外に保存されます。生成したデータを確認してから、まず dry run（確認実行）で取り込み内容を確認し、その後に取り込んでください。

```sh
make oracle-gen-workbook TARGET=<name> SUITE=<category>
make oracle-promote TRACK=workbook TARGET=<name> DRY_RUN=1
make oracle-promote TRACK=workbook TARGET=<name>
```

承認済みのデータは `oracle-promote` で取り込みます。JSON をコピーするだけではテスト対象になりません。

## レビュー観点

Oracle データ追加 PR は次の点でレビューされます。

- ターゲット名とターゲット一覧のエントリが正しい
- Excel ビルド・OS・ロケールのメタデータが記録されている
- ゴールデンデータが検証ツールの探索パス配下に置かれている
- スクリーンショットや入力サンプルに個人情報が混入していない

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ この作業が必要な理由
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ データの使われ方
- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ 公開プロファイルカタログ
