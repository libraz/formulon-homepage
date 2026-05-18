# リリースチェックリスト

各パッケージビルドが緑であるだけでは不十分です。リリースが健全と言えるのは、全 surface がワークブック挙動に対して一致しており、互換性の説明も現実と整合しているときです。

::: info 用語: same-revision release
出荷する成果物 ─ WASM / Native Node / Python wheel / CLI バイナリ / MCP server / `formulon-cell` ─ がすべて core の同じ Git revision から作られたリリースのこと。「ある surface だけ修正が入って、別 surface には入っていない」という微妙なバグを防ぎます。
:::

## リリース前

- [ ] core テスト（`make test-all`）
- [ ] 利用可能 profile の oracle テスト（`make oracle-verify`）
- [ ] WASM size budgets の検証（`make size-check`）
- [ ] JavaScript / Python / CLI / native artifact を同じ revision からビルド
- [ ] 各パッケージ surface の smoke test
- [ ] 利用可能 surface を stage 後に `make parity-test`
- [ ] `RegistryCatalog.CoverageReport` を実行し、変化があれば [数式カバレッジ](/ja/compatibility/formula-coverage) を更新
- [ ] [互換性](/ja/compatibility/) の status claim を確認
- [ ] changelog と docs バージョンの更新

## 各ステップで防げること

| 手順 | 検出対象 |
| --- | --- |
| `make test-all` | engine 内部の回帰 |
| `make oracle-verify` | Formulon と捕捉済み Excel 値のずれ |
| `make size-check` | ページ読み込みを遅くする WASM bloat |
| same-revision build | 部分ビルドによる cross-surface drift |
| 各 surface の smoke test | packaging / binding 限定の回帰 |
| `make parity-test` | 同じ入力に対し surface 間で異なる値を返す状況 |
| `RegistryCatalog.CoverageReport` | docs の関数数が古いまま |
| 互換性監査 | 成立しなくなった「Excel-compatible」表現 |
| changelog / docs | アップグレード後にユーザーが驚く差分 |

::: warning パッケージビルドが緑なだけでは足りない
リリースが健全なのは surface 同士がワークブック挙動で一致しているとき。WASM と Python で recalc 結果が違うほうが、両方が少しずつ間違っているより悪いユーザー体験です（一致していれば 1 つのメンタルモデルでデバッグできる）。
:::

## リリース後

- [ ] Git で tag を付けて push
- [ ] 成果物の公開（npm / PyPI / GitHub Releases）
- [ ] docs サイトが追いかけているならホームページリポジトリの `docsVersion` を更新
- [ ] 入ってくる互換性報告を監視し、適切な oracle / profile に振り分け

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ 各テストターゲットの守備範囲
- [サイズ予算](/ja/development/size-budgets) ─ WASM の ceiling
- [互換性モデル](/ja/compatibility/model) ─ 互換性説明の根拠
