# Python で一括再計算

スケジュールジョブ、ノートブック、データパイプラインの一部としてスプレッドシート再計算を組み込むパターンです。ブラウザで動くエンジンと同じものを、ホスト言語だけ Python に置き換えて動かします。

::: tip ワークブックの入出力は端にまとめる
最初にバイト列を読み込み、明示的に変更して再計算し、最後にバイト列を書き出します。無関係なデータ読み込みの処理をこの範囲に混ぜなければ、失敗の原因を切り分けやすく、ジョブのテストも書きやすくなります。
:::

## 流れ

<DiagramFlow
  :steps="[
    { label: 'テンプレートを読む', note: 'ファイルシステムのバイト列' },
    { label: 'Workbook.load(bytes)', note: 'with ブロックで使う' },
    { label: '入力を設定', note: 'set_number / set_formula' },
    { label: 'recalc()', note: '依存する数式を評価' },
    { label: '検証', note: '対象セルを get_value で確認' },
    { label: 'save() か例外', note: '成功は書き込み、失敗はログと例外' }
  ]"
  label="バッチジョブの流れ。テンプレートのバイト列を読み込み、Workbook.load、set_number / set_formula で入力を設定し、recalc、get_value で検証する。検証に成功したら save して書き込み、失敗したらログを記録して例外を送出する"
  caption="with ブロックにより、例外を送出する経路でもエンジンのハンドルが解放されます。"
/>

`Workbook` を包む `with` ブロックは、失敗分岐で例外が送出された場合も含め、ブロックを抜けるときにエンジンのハンドルを解放します。

## ジョブの例

```python
from pathlib import Path
from formulon import Workbook

def recalc_report(input_path: Path, output_path: Path, revenue: float) -> None:
    with Workbook.load(input_path.read_bytes()) as wb:
        wb.set_excel_profile_id("win-365-en_US")
        wb.set_pinned_now(2026, 10, 9, 9, 30, 0)
        wb.set_number(0, 3, 1, revenue)  # Sheet1 の B4
        wb.recalc()
        output_path.write_bytes(wb.save())

recalc_report(Path("template.xlsx"), Path("report.xlsx"), 125_000.0)
```

プロファイルと時刻はファイルに保存されないため、このジョブは実行のたびに両方を設定します。設定しないと、ロケールや日付に依存する結果が実行ごとに変わる可能性があります。詳しくは [ロケールプロファイル](/ja/compatibility/locale-profiles) を参照してください。

## 複数セルを変更する

```python
from formulon import Workbook, ValueKind

INPUTS = [
    (0, 3, 1, 125_000.0),   # B4: revenue
    (0, 4, 1,  80_000.0),   # B5: COGS
    (0, 5, 1,  12_000.0),   # B6: marketing
]

with Workbook.load(template_bytes) as wb:
    wb.set_excel_profile_id("win-365-en_US")
    wb.set_pinned_now(2026, 10, 9, 9, 30, 0)
    for sheet, row, col, value in INPUTS:
        wb.set_number(sheet, row, col, value)
    wb.recalc()

    margin = wb.get_value(0, 8, 1)  # B9: gross margin
    if margin.kind is ValueKind.NUMBER and margin.number < 0:
        raise RuntimeError(f"Negative margin: {margin.number}")

    output_path.write_bytes(wb.save())
```

セルの変更には主に `set_number` / `set_text` / `set_formula` を使います。座標は 0 始まりの `(sheet, row, col)` です。詳しくは [ワークブック操作](/ja/workbook/operations) を参照してください。

## 検証パターン

リポジトリに小さな検証用ワークブックを置きます。

```sh
python jobs/recalc_reports.py
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values report.xlsx > report.values.txt
git diff --exit-code report.values.txt
```

ジョブを実行し、その出力を `dump --values` でスナップショットすると、ジョブのコードとワークブックのどちらの変更も検知できます。

::: warning 揮発性の入力は要対処
`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` は揮発性関数です。`WEBSERVICE`、CUBE 関数、`STOCKHISTORY` など外部サービス依存の関数はネットワークへアクセスせず、利用不可を表す固定の Excel エラーを返します。期待値スナップショットでは、揮発性の入力をテンプレート側で固定値に置き換えるか対象範囲から外し、外部サービス依存のセルは [数式カバレッジ](/ja/compatibility/formula-coverage) に従って記録するか除外してください。
:::

## エラー処理

```python
from formulon import Workbook, FormulonError, ValueKind

try:
    with Workbook.load(blob) as wb:
        wb.recalc()
        value = wb.get_value(0, 0, 0)
        if value.kind is ValueKind.ERROR:
            # セルの Excel エラー ─ 例外にせずデータとして処理
            log.warning("cell error: %s", value.error_code)
except FormulonError as e:
    # ホスト失敗（読み込めないバイト列、その他エンジンのステータスエラー）
    log.error("formulon host failure: %s", e)
    raise
```

## 適合性の確認

| ワークフロー | 推奨実行入口 |
| --- | --- |
| cron 駆動の夜間レポート | Python |
| Jupyter / Colab ノートブック | Python |
| ブラウザ内再計算 | WASM |
| 大規模処理を高スループットで行う Node サービス | Native Node |
| シェル駆動の CI スナップショット | CLI |

## 次に読むもの

- [Python API](/ja/api/python) ─ トップレベル API
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ スクリプトの裏で動くエンジンの流れ
- [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) ─ Python とスナップショットの組み合わせ
