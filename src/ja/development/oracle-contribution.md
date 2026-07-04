# Oracle 提供

Oracle データは検証済み互換性を広げる主な手段です。生成は実 Excel を駆動し、検証はコミット済みゴールデンデータを読むだけで CI でも安全に走らせられます。

::: info 用語: Oracle データの生成と検証
生成は実 Excel に対して取得ツールを走らせ、ゴールデン JSON を書き出す処理です。Excel を持つコントリビュータのマシンでだけ実行されます。検証はそのコミット済みゴールデンデータと Formulon 出力を比較する処理です。Excel は不要で CI でも安全です。
:::

::: warning Microsoft 365 限定
Oracle データは **Excel 365**（Microsoft 365 サブスクリプション）から取得する必要があります。Office 2019 以前はサポート対象外です ─ `ARRAYTOTEXT`、`LAMBDA`、動的配列系関数（`SORT` / `FILTER` / `UNIQUE` / `XLOOKUP` など）は post-2019 の関数であり、Office 2019 では警告なしに `#NAME?` を返します。これをそのまま取り込むとゴールデンデータに誤った値が焼き付いてしまいます。3 つの生成コマンド（`oracle-gen` / `oracle-gen-cf` / `oracle-gen-workbook`）はすべて起動時に `=ARRAYTOTEXT(1)` を評価するセンチネルチェックを行い、Excel がこれを認識しなければ明確なエラーで生成を中止します。通常の利用でこれに当たることはないはずですが、誤ったインストール先を対象にしてしまう事故を防ぐ安全網として存在します。
:::

<DiagramLayers :layers="[
  { title: 'コントリビュータ環境', nodes: ['実 Excel 365（ロケール別ビルド）'] },
  { title: '生成', nodes: ['make oracle-contribute / oracle-gen[-cf|-workbook]'] },
  { title: '取得', nodes: ['ゴールデン JSON + build / OS / locale のメタデータ'] },
  { title: 'レビュー', nodes: ['Pull request'] },
  { title: 'CI', nodes: [{ label: 'make oracle-verify', note: 'Excel 不要' }] },
  { title: '比較', nodes: ['Formulon エンジン vs 取得済みゴールデン'] },
  { title: '結果', nodes: ['互換性 OK', 'oracle-testing のフローで調査'] }
]" />

## 提供フロー

1. 提供対象ロケールの Excel 365 を用意する。
2. リポジトリルートで `make oracle-contribute` を実行する。
3. 生成されたゴールデンデータとメタデータを確認する。
4. データを乗せた pull request を出す。

各提供データには platform / Excel build / locale / profile identity を含めてください。後からゴールデンデータと Formulon が食い違ったときに、どの Excel build で取り直すべきかをメタデータから追えるようになります。

## ターゲット

ターゲット名は `<host>-<excel-major>-<locale>` の形式です（例: `mac-365-ja_JP` / `win-365-ja_JP`）。manifest は `tools/oracle/targets.yaml`。

現在募集中のロケールは英語・ドイツ語・フランス語・中国語・韓国語・タイ語の Excel 環境です。これらのターゲットを 1 つでも提供すると、推測ではなく実測のロケール挙動が増えます。

::: tip 提供範囲は完全でなくてよい
全関数を網羅する必要はありません。1 ロケール x 1 関数族（テキスト / 日付 / 検索など）のゴールデンデータでも、互換性カバレッジの意味のあるアップグレードになります。
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

`make oracle-verify` は CI で動きます。それ以外は Excel が必要で、コントリビュータのマシンでだけ実行します。`oracle-gen` は数式のゴールデンを扱い、`oracle-gen-cf` は条件付き書式トラック（macOS 限定）を、`oracle-gen-workbook` はピボットテーブル / 印刷範囲トラックを扱います（`TARGET` を省略するとホスト OS から自動判定されます）。

## レビュー観点

Oracle データ追加 PR は次の点でレビューされます。

- ターゲット名と manifest エントリが正しい
- Excel build / OS / locale のメタデータが記録されている
- ゴールデンデータが verifier の探索パス配下に置かれている
- スクリーンショットや入力サンプルに個人情報が混入していない

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ この作業が必要な理由
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ データの使われ方
- [ロケールプロファイル](/ja/compatibility/locale-profiles) ─ 公開プロファイルカタログ
