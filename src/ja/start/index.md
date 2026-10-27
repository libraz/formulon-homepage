# はじめる

Formulon は、Excel の操作画面を使わずに動くスプレッドシート計算エンジンです。実行する環境を選び、小さな数式でインストールを確認してから、実際に使うワークブックを検証します。

::: tip 表計算エンジンを初めて使う場合
[基本概念](/ja/start/concepts) では、3 製品の役割、セルの座標、数式・計算結果・表示文字列の違いを説明しています。読み進める途中で知らない言葉が出てきたら [用語集](/ja/glossary) を参照してください。
:::

## 推奨順序

<DiagramFlow
  :steps="[
    { label: '実行入口を選ぶ', note: 'WASM、Python、CLI、MCP など' },
    { label: 'インストール', note: '選んだ入口のパッケージ' },
    { label: '数式を 1 つ評価', note: 'パッケージが動くことを確認' },
    { label: 'ワークブックを 1 つ再計算', note: '実際に使うファイルで試す' },
    { label: 'Excel と比べる', note: '違う場合は互換性を確認' },
    { label: '利用例へ進む', note: '目的に近いシナリオを選ぶ' }
  ]"
  label="推奨順序。実行入口を選び、インストールし、数式を 1 つ評価し、ワークブックを 1 つ再計算し、結果を Excel と比べてから利用例へ進む"
  caption="まず数式 1 つで導入を確かめ、次に実際のワークブックで用途に合うかを確かめてから、利用例を組み立てます。"
/>

1. [実行入口を選び](/ja/start/choose-runtime)、対応するパッケージをインストールする。
2. 1 つの数式を Formulon で動かす。
3. 1 つのワークブックを再計算する。
4. Excel と結果が違う場合は [数式カバレッジ](/ja/compatibility/formula-coverage)、[ファイル形式サポート](/ja/compatibility/file-format-support)、[エラーモデル](/ja/compatibility/errors) を確認する。
5. 具体的な [利用例](/ja/scenarios/) に進む。

## 最初のタスク

| タスク | ページ |
| --- | --- |
| ワークブックの仕組みと 3 製品の役割を知る | [基本概念](/ja/start/concepts) |
| WASM / Python / Native Node / CLI / MCP / C ABI を選ぶ | [実行入口を選ぶ](/ja/start/choose-runtime) |
| パッケージを入れる | [インストール](/ja/start/install) |
| 1 つの数式を評価する | [数式を評価する](/ja/start/evaluate) |
| ワークブックを再計算する | [ワークブックを再計算する](/ja/start/recalculate) |
| よくある組み込みエラーを直す | [トラブルシュート](/ja/start/troubleshooting) |
| 具体的な流れから始める | [利用例](/ja/scenarios/) |

## 関心事別の読み進め方

最初の実行が済んだら、関心事ごとに読み進めます。

- 実行環境への組み込み: [WASM](/ja/runtimes/wasm), [Python](/ja/runtimes/python), [Native Node](/ja/runtimes/node-native), [CLI](/ja/runtimes/cli)
- ワークブックの挙動: [ライフサイクル](/ja/workbook/lifecycle), [数式エンジン](/ja/workbook/formula-engine), [再計算](/ja/workbook/recalculation)
- 互換性: [数式カバレッジ](/ja/compatibility/formula-coverage), [ファイル形式サポート](/ja/compatibility/file-format-support), [エラーモデル](/ja/compatibility/errors)
- API 詳細: [API 一覧](/ja/api/surfaces), [WASM API](/ja/api/wasm), [Python API](/ja/api/python), [CLI リファレンス](/ja/api/cli)
