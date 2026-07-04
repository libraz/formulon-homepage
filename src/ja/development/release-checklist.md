# リリースチェックリスト

各パッケージビルドが緑であるだけでは不十分です。リリースが健全と言えるのは、全実行入口がワークブック挙動に対して一致しており、互換性の説明も現実と整合しているときです。

::: info 用語: same-revision release
出荷する成果物（WASM、Native Node、Python wheel、CLI バイナリ、MCP サーバー、`formulon-cell`）がすべてコアの同じ Git revision から作られたリリースのことです。「ある実行入口だけ修正が入って、別の実行入口には入っていない」という微妙なバグを防ぎます。
:::

## リリース前

- [ ] コアテスト（`make test-all`）
- [ ] 利用可能プロファイルの Oracle テスト（`make oracle-verify`）
- [ ] WASM size budgets の検証（`make size-check`）
- [ ] JavaScript / Python / CLI / ネイティブ成果物を同じ revision からビルド
- [ ] 各パッケージ API のスモークテスト
- [ ] 利用可能な実行入口をステージ後に `make parity-test`
- [ ] `RegistryCatalog.CoverageReport` を実行し（`ctest -R RegistryCatalog.CoverageReport -V` を build ディレクトリで ─ 診断専用で常に成功し、カバレッジ比率は標準出力に出ます）、変化があれば [数式カバレッジ](/ja/compatibility/formula-coverage) を更新
- [ ] [互換性](/ja/compatibility/) のステータス表現を確認
- [ ] changelog とドキュメントバージョンの更新

## 各ステップで防げること

| 手順 | 検出対象 |
| --- | --- |
| `make test-all` | エンジン内部の回帰 |
| `make oracle-verify` | Formulon と捕捉済み Excel 値のずれ |
| `make size-check` | ページ読み込みを遅くする WASM サイズ増加 |
| same-revision build | 部分ビルドによる実行入口間のずれ |
| 各 API のスモークテスト | パッケージング / バインディング限定の回帰 |
| `make parity-test` | 同じ入力に対し実行入口間で異なる値を返す状況 |
| `RegistryCatalog.CoverageReport` | ドキュメントの関数数が古いまま |
| 互換性監査 | 成立しなくなった「Excel-compatible」表現 |
| changelog / docs | アップグレード後にユーザーが驚く差分 |

::: warning パッケージビルドが緑なだけでは足りない
リリースが健全なのは実行入口同士がワークブック挙動で一致しているときです。WASM と Python で再計算結果が違うほうが、両方が少しずつ間違っているより悪いユーザー体験です（一致していれば 1 つのメンタルモデルでデバッグできます）。
:::

## リリース後

- [ ] タグを付けて push する（`git tag vX.Y.Z && git push origin vX.Y.Z`）─ この push そのものがリリースです。タグ駆動の `release.yml` ワークフローがトリガーされ、OIDC trusted publishing 経由で npm / PyPI / CLI バイナリ / GitHub Release を自動的にビルド・公開します。手動で公開する手順は別途ありません。手作業で何かを公開しようとせず、ワークフローの完走を見届けてください。
- [ ] docs サイトが追いかけているならホームページリポジトリの `docsVersion` を更新
- [ ] 入ってくる互換性報告を監視し、適切な Oracle データ / プロファイルに振り分け

<DiagramFlow steps="develop で作業 → main への PR → CI green → merge → vX.Y.Z タグを push" />

<DiagramLayers :layers="[
  { title: 'release.yml（タグ起点）', nodes: ['publish-npm', 'build-cli', 'python-wheel', 'publish-pypi', 'attach-cli'] },
  { title: '結果', nodes: ['npm + PyPI + CLI バイナリ + GitHub Release ─ 公開済み'] }
]" />

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ 各テストターゲットの守備範囲
- [サイズ予算](/ja/development/size-budgets) ─ WASM の ceiling
- [互換性モデル](/ja/compatibility/model) ─ 互換性説明の根拠
