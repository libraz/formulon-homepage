# Oracle データの提供

Oracle の生成では、実際の Excel から結果を取得します。検証はコミット済みゴールデンを使うため Excel を必要とせず、CI でも実行できます。

::: info 生成と検証
生成では Excel を操作してゴールデンデータと取得メタデータを書き出します。検証ではコミット済みケースを Formulon で再計算し、そのゴールデンと比較します。Excel が必要なのは生成時だけです。
:::

::: warning Microsoft 365 が必要です
Oracle の取得には Microsoft 365 の Excel を使います。4 つの取得コマンド（`oracle-gen` / `oracle-gen-cf` / `oracle-gen-chart` / `oracle-gen-workbook`）は起動時に `=ARRAYTOTEXT(1)` を評価し、Excel が認識しない場合は中止します。Office 2019 以前では、新しい関数を正しく取得できません。
:::

## 提供の流れ

1. `make oracle-setup` で Oracle 用の環境を準備します。
2. `make oracle-contribute` を実行します。ターゲットを指定する場合は `TARGET=<target>` を付けます。
3. 生成されたゴールデンと取得メタデータを確認します。
4. 変更をレビューに提出します。

`make oracle-contribute` はインストール済み Excel のビルドとロケールを調べ、対応するターゲットを選びます。コミット済みデータがその Excel ビルドをすでにカバーしている場合は、再取得が不要だと表示します。ターゲット名は `<host>-365-<locale>` の形式です。例は `mac-365-ja_JP` と `win-365-ja_JP` です。

macOS では、要求されたらターミナルから Microsoft Excel の自動操作を許可します。Mac の別ロケールで取得する前に、Excel の `AppleLanguages` と `AppleLocale` の設定値を記録してください。取得対象のロケールを設定して Excel を終了・再起動してから取得します。取得後は記録した値に戻してください。取得前に設定されていなかったキーだけ削除します。

WSL2 では `make oracle-setup` が Windows 側のセットアップ手順を表示します。`FORMULON_WIN_PYTHON` に Windows 側の `python.exe` のパスを設定してください。その Python には `xlwings` / `pywin32` / `pyyaml` が必要です。WSL 側で Python の検査を直接実行するときは、リポジトリの `tools/oracle/.venv/bin/python` を使います。

## ターゲットとトラック

数式トラックのマニフェストには、現在 Mac Excel 365 のゲートが 14 個あります。ja-JP のプライマリと、en-US、de-DE、fr-FR、zh-CN、ko-KR、th-TH、es-ES、es-MX、pt-BR、ru-RU、zh-TW、it-IT、nl-NL です。ワークブックトラックのプライマリは Windows 版 Excel 365 ja-JP です。その他の Windows ロケールプロファイルは、実機の Windows 取得に置き換わるまで、Mac の取得結果と Windows 固有の規則から推定します。

グラフと条件付き書式は Mac Excel 365 ja-JP を使います。グラフのケースは `tests/oracle/cases_chart/`、ゴールデンは `tests/oracle/targets/mac-365-ja_JP/golden_chart/` にあります。取得では Excel が保存したワークブックを読み込みます。対象ケースによっては Formulon が生成したファイルも Excel で開いて保存し、その結果を確認します。グラフモデルの読み取りには `chart_model_dump` を使います。

ターゲットのディレクトリがあっても、ゴールデンがテスト対象になるとは限りません。CTest で使うかどうかは、ターゲットマニフェストと来歴情報で決まります。その他の組み合わせは、マニフェストが有効化するまで調査用です。

## 取得コマンド

Formulon のソースルートから実行します。

```sh
make oracle-setup
make oracle-contribute
make oracle-contribute TARGET=win-365-de_DE
make oracle-gen TARGET=mac-365-ja_JP SUITE=datetime
make oracle-gen-cf SUITE=<suite>
make build
make oracle-gen-chart SUITE=<suite>
make oracle-gen-workbook TARGET=win-365-ja_JP
make oracle-verify
```

`oracle-gen-chart` は取得前に `chart_model_dump` をビルドするため、先に `make build` を実行してビルドディレクトリを設定してください。グラフの取得は macOS と Microsoft 365 Excel でのみ実行できます。

数式、条件付き書式、グラフの生成コマンドでは、スイートを指定して対象を絞れます。全体を取得するときはスイートを指定しません。新しいワークブックターゲットを登録する場合は、プロモーション前に必須スイートをすべて取得してください。

### ワークブックターゲットの登録

新しい Windows ワークブックターゲットは、来歴とゴールデンをレビューするまでリポジトリ外に仮置きします。スイートを指定せず全体を取得し、内容を確認してから書き込みを伴わないプロモーション検査を実行します。

```sh
make oracle-gen-workbook TARGET=<name>
make oracle-promote TRACK=workbook TARGET=<name> DRY_RUN=1
make oracle-promote TRACK=workbook TARGET=<name>
```

登録が完了すると、ターゲットの来歴情報が記録されます。ワークブックの CTest が選択するのは、`tools/oracle/targets.yaml` の `tracks.workbook.primary`（現在は `win-365-ja_JP`）だけです。別の Windows ロケールを登録しても、そのワークブックテストは追加されません。テスト設定で選択するまでは研究用データとして扱います。JSON をコピーしただけではワークブックテストは有効になりません。

## 提供内容のレビュー

マニフェストのターゲットとロケールが Excel 環境に合っていること、取得したビルドと OS が記録されていること、ゴールデンがトラックに対応したディレクトリにあることを確認します。取得時に生成された来歴ファイルも含めてください。ケース定義と差分を確認し、個人情報を誤って含めていないか確認してから提出します。

## 次に読むページ

- [互換性モデル](/ja/compatibility/model) — プロファイルごとの測定の目的。
- [Oracle テスト](/ja/compatibility/oracle-testing) — 検証と差分記録の仕組み。
- [ロケールプロファイル](/ja/compatibility/locale-profiles) — 提供中のプロファイル。
