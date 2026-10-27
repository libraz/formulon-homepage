# 利用例

Formulon を具体的な処理の流れに組み込む例です。シナリオごとに使う実行入口や製品が異なります。デプロイ先に近いものを選び、設定詳細は対応する [実行環境](/ja/runtimes/) ページを参照してください。

::: info 実ワークブックで早めに試す
1 つの数式が動くことを確認したら、代表的なワークブックを早めに通してみてください。スプレッドシートエンジンが実際に使えるかどうかは、孤立した数式ではなく、ワークブック全体の構造で決まります。
:::

<DiagramLayers
  :layers="[
    { title: 'ワークブックの入口', nodes: [
      { label: 'ブラウザでアップロード', note: 'WASM、ファイルは端末内' },
      { label: 'アップロード API / 社内サービス', note: 'Native Node か WASM' },
      { label: '定期ジョブ / ノートブック', note: 'Python' },
      { label: 'プルリクエスト', note: 'CI で CLI スナップショット' },
      { label: 'AI エージェント', note: 'formulon-mcp のツール', tone: 'alt' },
      { label: 'Web アプリの表計算 UI', note: 'formulon-cell（ベータ）', tone: 'alt' }
    ] },
    { title: '共通エンジン', nodes: [{ label: '1 つの C++17 コア', note: 'load → mutate → recalc → save' }] }
  ]"
  label="ワークブックが Formulon に届く 6 つの経路。ブラウザでのアップロードは WASM、アップロード API や社内サービスは Native Node か WASM、定期ジョブやノートブックは Python、プルリクエストは CI の CLI スナップショット、AI エージェントは formulon-mcp、表計算 UI は formulon-cell を通る。6 つとも同じ C++17 コアで計算する"
  caption="シナリオごとに違うのはバイト列の出所と行き先で、計算するのは同じコアです。"
/>

| 利用例 | 実行入口 | 目的 |
| --- | --- | --- |
| [ブラウザでワークブックを開く](/ja/scenarios/browser-upload) | WASM | `.xlsx` をサーバーに送らずブラウザ内で再計算 |
| [Node サービスで再計算](/ja/scenarios/node-service) | Native Node / WASM | アップロードまたは社内生成したワークブックを API の裏側で再計算 |
| [Python で一括再計算](/ja/scenarios/python-batch) | Python | ジョブやノートブックで帳票やモデルを再計算 |
| [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) | CLI | 自動チェックで数式や計算値のずれを検出 |
| [AI エージェントからワークブックを編集](/ja/mcp/) | MCP | `formulon-mcp` 経由でエージェントが `.xlsx` または `.xlsb` を開いて編集・再計算・保存 |
| [Web アプリの表計算 UI](/ja/cell/) | formulon-cell（WASM） | 自分のページの中でワークブックを表示・編集。ベータ版なので、エンドユーザー向けに出す前に評価が必要 |

## シナリオ共通の構造

どのシナリオも [ワークブックの流れ](/ja/workbook/lifecycle) で説明している `load → mutate → recalc → save` を踏みます。異なるのは次の点です。

- バイト列の出所（`File`、ファイルシステム、入出力ストリーム、MCP ツール入力）
- バイト列の行き先（`save()` の戻り値、ファイル書き込み、返却 `bytes` フィールド）
- メモリと入出力の所有者
- エラーがホスト境界をどう渡るか

## 互換性ゲート

どのシナリオでも、導入前にワークブック内の数式を確認し、外部サービスに依存する関数をどう扱うか決めてください。Formulon は認識対象 526 件のうち **511 件を実装**しています（環境依存の `CELL`・`INFO` を含む）。残る 15 件は `COPILOT`、`PY`、`IMAGE`、`WEBSERVICE`、`STOCKHISTORY`、`RTD`、CUBE 接続関数など、外部サービスに依存するため利用不可を示す固定の Excel エラーを返します。これらを含むワークブックは、拒否する、互換性警告を表示する、Excel 連携の別経路に回す、といったプロダクト上の判断が必要です。

実行入口ごとの設定は [実行環境](/ja/runtimes/)、エンジン側のフローは [ワークブックの流れ](/ja/workbook/lifecycle) を参照してください。
