# Oracle テスト

Oracle テストは、対象ケース・プロファイル・Excel ビルドを指定して Microsoft 365 Excel から取得した結果と Formulon を比較します。記録するのはその入力で観測した挙動です。Excel 全体を網羅する保証ではありません。

::: info Oracle ゴールデン
Oracle ゴールデンは、既知のワークブックまたはケース、ロケールプロファイル、Excel ビルドで取得した結果をコミットしたファイルです。検証では Formulon でケースを再計算し、取得済みの結果と比較します。
:::

::: info 受け入れ済み差分（accepted divergence）
受け入れ済み差分は、Formulon が意図的に Excel と異なる挙動をするケースです。レジストリには差分を残す理由、どちらの結果を採用するか、最後に確認した Excel ビルドを記録します。
:::

## Oracle のトラック {#verification-tracks}

| トラック | 検証する内容 | 取得元 |
| --- | --- | --- |
| 数式のプライマリ | ja-JP プロファイルでの数式結果 | Mac Excel 365、`mac-365-ja_JP` |
| ロケール別の数式ゲート | 他のロケールプロファイルでの数式結果。マニフェストには Mac の追加ゲートが現在 13 個あります | ロケールごとの Mac Excel 365 |
| 条件付き書式 | ルール判定と書式表示の挙動 | Mac Excel 365、ja-JP |
| グラフ | グラフの作成と編集、キャッシュ値、参照の挙動 | Mac Excel 365、ja-JP |
| ワークブック | ピボットテーブルの構造と印刷レイアウト | Windows 版 Excel 365、ja-JP |

数式トラックには Mac Excel 365 のターゲットが 14 個あります。ja-JP のプライマリと、13 個のロケール別ゲートです。ワークブックトラックのプライマリは Windows 版 Excel 365 ja-JP です。ピボットテーブルの作成に Windows の COM 自動化が必要なためです。グラフと条件付き書式は Mac の ja-JP ターゲットを使います。各ターゲットの取得メタデータには Excel ビルドとロケールが記録されます。ワークブックの取得には、スイート間の証拠を結び付ける取得識別子もあります。

ターゲットのディレクトリがあるだけでは、そのトラックがゲートになるわけではありません。CTest でどの取得データを使うかは、ターゲットマニフェストと来歴情報で決まります。別のホストやロケールのデータは、マニフェストが有効化するまで調査用です。残りの Windows ロケールプロファイルは、実際の Windows 取得に置き換わるまで Mac の測定値と Windows 固有の規則から推定しています。

IronCalc コーパスは別の照合材料です。IronCalc プロジェクトが管理する xlsx フィクスチャから、保存済みの数式結果を取り込みます。インポーターは保存時のアプリケーションとバージョンを記録し、メタデータが Excel 製品を示さないフィクスチャを除外します。保存済みの結果は複数の Excel 製品や環境に由来するため、特定の Excel 365 ターゲットから統制して取得したデータではありません。検証には `make ironcalc-verify` を実行します。

## 取得済みテストの実行

Formulon のソースチェックアウトでテストバイナリをビルドし、Oracle ラベルの CTest を実行します。

```sh
make build
make oracle-verify
```

このコマンドは現在の CMake ビルド設定を使います。検証時に Excel は起動せず、コミット済みのゴールデンを読み込みます。

## Excel との差分を詰める

失敗したケース ID と対象ターゲットのゴールデンを確認します。ターゲットの Excel ビルドとロケールのメタデータを調べ、ケースの入力、Formulon の結果、Excel から取得した結果を比較します。Excel ビルドやターゲットが変わった場合は、同じターゲットで再取得します。生成されたメタデータとゴールデンを確認してから更新します。

数値比較は既定で完全一致です。絶対許容差と相対許容差はどちらもゼロです。一部のスイートではゼロ以外の許容差を設定し、ケース単位で上書きできます。ケースに `compare_mode` を指定すると、比較方法も切り替わります。小さな数値差を判断するときは、ケースとスイートの設定を確認してください。許容差を変えても、正解の出所は変わりません。

スキップは原因ごとに分類します。原因ラベルは異なる作業を示すため、失敗を隠す目的で入れ替えないでください。

| 原因 | 意味と次の作業 |
| --- | --- |
| `excel-no-value` | Excel が数式を拒否したか、再現できる比較結果を返しません。リリース率の分母から除外できる唯一の原因です。 |
| `harness-cannot-capture` | Excel は結果を返しましたが、取得ブリッジが記録できません。ハーネスを修正し、ケースを見える状態に保ちます。 |
| `engine-gap` | Excel は結果を返しましたが、Formulon は未実装か一致していません。エンジンを修正します。 |
| `accepted-divergence` | Formulon が意図的に異なる結果を返します。理由、採用する結果、最後に検証した Excel ビルドを記録します。 |
| `non-identifiable` | 数学的に一意な値がないため、一致する値を決められません。根拠を記録します。 |
| `unclassified` | 手元の証拠では原因を特定できません。資料を確認するまで未分類のままにします。 |

`tests/divergence.yaml` のスキップ項目には、厳格な来歴検証を実行します。

```sh
tools/oracle/.venv/bin/python tools/oracle/divergence_check.py --strict
```

この検証は、差分項目が現行ケースを指し、証拠が古くなっていないことを確認します。Formulon の数値と Excel の結果は比較しません。リリース条件は、失敗がゼロであることと、合格率が 99.5% 以上であることです。分母には、プライマリ Oracle が値を返したケースを含めます。除外できるのは `excel-no-value` だけです。この率は全体の網羅率ではありません。未実装の関数や未検証の挙動は分母に含まれません。

## メタデータの完了と値の一致は別です

関数の完了レポートはメタデータを確認します。宣言した挙動、それを検証するケース、対応するゴールデン、差分の記録、実装と Oracle の出所、挙動カタログとのずれが対象です。数式を実行したり、数値の一致を測ったりはしません。分母は関数カタログと、ソースを走査して実装済みと判定した関数の共通部分です。

`--report` と `--status` は状況確認用で、未完了の関数があっても終了コード 0 を返します。最新のレポートは次のコマンドで表示します。

```sh
tools/oracle/.venv/bin/python tools/oracle/closure_check.py --report --json
```

関数やファミリーの未完了状態を失敗として扱うには、対象を直接指定します。

```sh
tools/oracle/.venv/bin/python tools/oracle/closure_check.py SUM
tools/oracle/.venv/bin/python tools/oracle/closure_check.py family=math_trig
```

ワークブックの完了検査も、標準では未取得のデータを許容します。ゴールデンがないことだけでは失敗になりません。

```sh
tools/oracle/.venv/bin/python tools/oracle/workbook_closure_check.py
```

`--require-active` を付けると、マニフェストと来歴情報で検証済みと認めたワークブック取得が必要になります。この厳格な検査は、CMake を `-DFORMULON_ORACLE_RELEASE_GATES=ON` で設定した場合に限り `oracle-release` として登録されます。ラベルを指定するだけでは通常のビルドや `make oracle-verify` に追加されません。リリース検査を設定し、対象ラベルを明示して実行します。

```sh
cmake -S . -B build -DFORMULON_ORACLE_RELEASE_GATES=ON
ctest --test-dir build -L oracle-release --output-on-failure
```

## 次に読むページ

- [互換性モデル](/ja/compatibility/model) — プロファイルと文書化した差分。
- [ロケールプロファイル](/ja/compatibility/locale-profiles) — 利用できる Excel プロファイル。
- [テキスト照合順序](/ja/compatibility/text-collation) — プロファイル別に測定した文字列順序。
- [Oracle データの提供](/ja/development/oracle-contribution) — データの取得と提供。
