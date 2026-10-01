# リリースチェックリスト

各パッケージのビルドが成功しているだけでは不十分です。リリースでは、すべての実行環境でワークブックの挙動が一致し、互換性の説明も現実と整合していることを確認します。

::: info 用語: 同一リビジョンからのリリース
WASM、Native Node、Python wheel、CLI バイナリを、コアの同じ Git リビジョンからビルドするリリースです。コアの各バインディングに同じ修正を含めます。MCP と `formulon-cell` は別パッケージなので、更新前に対応するエンジンの依存指定を確認します。
:::

## リリース前

- [ ] コアテスト（`make test-all`）
- [ ] 基準となる Oracle 検証（`make oracle-verify`）。対応するバリアントを変更した場合は `FORMULON_ORACLE_VARIANTS=ON` を有効にし、`formulon_oracle_variant_tests` と `formulon_workbook_oracle_variant_tests` をビルドして `ctest -L VARIANT` を実行します
- [ ] WASM のサイズ上限を検証（`make size-check`）
- [ ] JavaScript / Python / CLI / ネイティブ成果物を同一リビジョンからビルド
- [ ] 各パッケージ API のスモークテスト
- [ ] 利用可能な実行環境をステージ後に `make parity-test` で比較
- [ ] `RegistryCatalog.CoverageReport` を実行し（`ctest -R RegistryCatalog.CoverageReport -V` を build ディレクトリで ─ 診断専用で常に成功し、カバレッジ比率は標準出力に出ます）、変化があれば [数式カバレッジ](/ja/compatibility/formula-coverage) を更新
- [ ] [互換性](/ja/compatibility/) のステータス表現を確認
- [ ] 変更履歴とドキュメントバージョンの更新

## 各ステップで防げること

| 手順 | 検出対象 |
| --- | --- |
| `make test-all` | エンジン内部の回帰 |
| `make oracle-verify` | Formulon と取得済み Excel 値のずれ |
| `make size-check` | ページ読み込みを遅くする WASM サイズの増加 |
| 同一リビジョンのビルド | 部分ビルドによる実行環境間のずれ |
| 各 API のスモークテスト | パッケージング / バインディング限定の回帰 |
| `make parity-test` | 同じ入力に対し実行環境間で異なる値を返す状況 |
| `RegistryCatalog.CoverageReport` | ドキュメントの関数数が古いまま |
| 互換性監査 | 成立しなくなった「Excel-compatible」表現 |
| 変更履歴 / ドキュメント | アップグレード後にユーザーが驚く差分 |

::: warning パッケージビルドだけでは実行環境間の一致を確認できません
リリース前にパリティ検証とバインディングのスモークテストを実行してください。利用可能な実行環境間の一致と、ホスト側の型変換・リソース管理を確認できます。
:::

## 公開と確認

- [ ] タグを付けて push します（`git tag vX.Y.Z && git push origin vX.Y.Z`）。タグで `release.yml` が起動し、Trusted Publishing で npm と PyPI を公開し、GitHub Actions のワークフロー認証情報で GitHub Release と CLI アセットを作成します。
- [ ] 同じタグで別に起動する `prebuild.yml` の Native Node マトリクスと `release-bundle` を確認します。ネイティブ成果物は個別に検証します。
- [ ] ドキュメントサイトの対象バージョンに合わせてホームページリポジトリの `docsVersion` を更新します。npm 公開後にデモ用のルート依存を更新し、`@libraz/formulon` に対するルート `package.json` の `resolutions` 指定を削除して lockfile を再生成します。画面に表示される実行バージョンを確認します。`formulon-cell` のアダプターが新しいアクセサの戻り値に対応するまでは、同パッケージが対応するエンジンの依存指定を維持します。
- [ ] 互換性報告を監視し、適切な Oracle データ / プロファイルに振り分けます

<DiagramFlow steps="develop で作業 → main への PR → CI 成功 → merge → vX.Y.Z タグを push → release.yml + prebuild.yml → 成果物を確認" />

<DiagramLayers :layers="[
  { title: 'release.yml（タグ起点）', nodes: ['publish-npm', 'build-cli', 'python-wheel', 'publish-pypi', 'attach-cli'] },
  { title: 'prebuild.yml（同じタグ）', nodes: ['Native Node マトリクス', 'release-bundle'] },
  { title: '結果', nodes: ['npm + PyPI + CLI バイナリ + GitHub Release + Native Node 成果物 ─ 確認済み'] }
]" />

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ 各テストターゲットの守備範囲
- [サイズ上限](/ja/development/size-budgets) ─ WASM の上限
- [互換性モデル](/ja/compatibility/model) ─ 互換性説明の根拠
