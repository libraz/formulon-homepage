# リリースチェックリスト

各パッケージのビルドが成功しているだけでは不十分です。リリースでは、すべての実行環境でワークブックの挙動が一致し、互換性の説明も現実と整合していることを確認します。

::: info 用語: 同一リビジョンからのリリース
WASM、Native Node、Python wheel、CLI バイナリを、コアの同じ Git リビジョンからビルドするリリースです。コアの各バインディングに同じ修正を含めます。MCP と `formulon-cell` は別パッケージなので、更新前に対応するエンジンの依存指定を確認します。
:::

## リリース前

- [ ] コアテスト（`make test-all`）
- [ ] 基準となる Oracle 検証（`make oracle-verify`）。対応するバリアントを変更した場合は `FORMULON_ORACLE_VARIANTS=ON` を有効にし、`formulon_oracle_variant_tests` と `formulon_workbook_oracle_variant_tests` をビルドして `ctest -L VARIANT` を実行します
- [ ] 差分レジストリを確認（`tools/oracle/.venv/bin/python tools/oracle/divergence_check.py --strict` が 0 で終了すること）。リリースの基準は Oracle の失敗ゼロです。合格率を示す前に、このツールが出力する原因別のスキップ集計を確認します
- [ ] ワークブックの取得が active であることを確認（`tools/oracle/.venv/bin/python tools/oracle/workbook_closure_check.py --require-active`）。通常の closure 検査は未取得を pending として扱うため、リリース判定にはこの指定が必要です
- [ ] WASM のサイズ上限を検証（`make size-check`）
- [ ] JavaScript / Python / CLI / ネイティブ成果物を同一リビジョンからビルド
- [ ] 各パッケージ API のスモークテスト
- [ ] 利用可能な実行環境をステージ後に `make parity-test` で比較
- [ ] 兄弟チェックアウトからコア WASM と cell パッケージをステージングした後、`yarn demos:prepare` でホームページのデモ用スナップショットを更新し、`vendor/manifest.json` のソースコミット、ソース差分 SHA-256、アーカイブ SHA-256 を確認する。その後 `yarn check:demos` と、兄弟チェックアウトなしの通常のホームページビルドを実行する
- [ ] ビルドディレクトリで `ctest -R RegistryCatalog.CoverageReport -V` を実行し、変化があれば [数式カバレッジ](/ja/compatibility/formula-coverage) を更新（診断専用で常に成功し、カバレッジ比率は標準出力に出ます）
- [ ] [互換性](/ja/compatibility/) のステータス表現を確認
- [ ] 変更履歴とドキュメントバージョンの更新
- [ ] `docsVersion` を更新後、`yarn gen:api --ref <core-commit>` で同じコアコミットから API 一覧を再生成し、`yarn check:api` を実行します。公開前もパッケージ依存は公開済みバージョンに保ちます

## 各ステップで防げること

| 手順 | 検出対象 |
| --- | --- |
| `make test-all` | エンジン内部の回帰 |
| `make oracle-verify` | Formulon と取得済み Excel 値のずれ |
| `divergence_check.py --strict` | 未検証または古い Excel の観測に頼ったままの受け入れ済み差分 |
| `make size-check` | ページ読み込みを遅くする WASM サイズの増加 |
| 同一リビジョンのビルド | 部分ビルドによる実行環境間のずれ |
| 各 API のスモークテスト | パッケージング / バインディング限定の回帰 |
| `make parity-test` | 同じ入力に対し実行環境間で異なる値を返す状況 |
| `RegistryCatalog.CoverageReport` | ドキュメントの関数数が古いまま |
| 互換性監査 | 成り立たなくなった「Excel 互換」という表現 |
| 変更履歴 / ドキュメント | アップグレード後にユーザーが驚く差分 |

::: warning パッケージビルドだけでは実行環境間の一致を確認できません
リリース前にパリティ検証とバインディングのスモークテストを実行してください。利用可能な実行環境間の一致と、ホスト側の型変換・リソース管理を確認できます。
:::

## 公開と確認

- [ ] develop の CI 成功後に main を fast-forward し、main の CI 成功後に注釈付きタグを付けて push します（`git tag -a vX.Y.Z -m "Release vX.Y.Z"` の後に `git push origin vX.Y.Z`）。タグで `release.yml` が起動し、Trusted Publishing で npm と PyPI を公開し、GitHub Actions のワークフロー認証情報で GitHub Release と CLI アセットを作成します。
- [ ] 同じタグで別に起動する `prebuild.yml` を確認します。`release-bundle` ジョブがビルド済みアドオンを `formulon-native-bundle` アーティファクトにまとめます。`@libraz/formulon-native` の npm 公開は手動で行います。
- [ ] タグを作成したら、公開済み C ABI のベースラインをそのタグに合わせて更新します（`python3 tools/dev/gen_c_abi_baseline.py vX.Y.Z`）。以降の ABI 変更はこのリリースを基準に検査されます。
- [ ] ホームページの `docsVersion` をドキュメントが対象とするソースのバージョンに合わせます。未公開の機能は Git 管理外のローカルスナップショットで確認します（`yarn test:local` と `yarn build:local`）。コア、`formulon-cell`、`formulon-cell-vue` の公開後にレジストリ依存を更新し、ロックファイルを再生成して、ローカルのエイリアスを使わずにテストとビルドを実行します。デプロイ前に、画面に表示される実行バージョンと言語切り替えデモを公開パッケージで確認してください。
- [ ] 互換性報告を監視し、適切な Oracle データ / プロファイルに振り分けます

<DiagramFlow
  label="リリースの順序です。develop で作業し、develop の CI を通し、main を fast-forward し、main の CI を通し、注釈付きタグを push して release.yml と prebuild.yml を動かし、成果物を確認します。"
  caption="タグは最後に push します。その前に develop と main の CI が通っている必要があります。"
  :steps="[
  { label: 'develop で作業', note: 'リリース前チェックを実行' },
  { label: 'develop の CI 成功', note: 'main を動かす前の条件' },
  { label: 'main を fast-forward', note: 'develop を main に反映' },
  { label: 'main の CI 成功', note: 'タグ付けの前提' },
  { label: '注釈付きタグを push', note: 'git tag -a vX.Y.Z' },
  { label: 'release.yml + prebuild.yml', note: '同じタグから起動' },
  { label: '成果物を確認', note: 'パッケージ・Release・CLI' }
]" />

<DiagramLayers
  label="タグから release.yml と prebuild.yml が起動します。release.yml は npm と PyPI に公開し、CLI をビルドして添付します。prebuild.yml は Native Node のプレビルドをまとめます。Native Node のバンドルは手動で npm に公開します。"
  caption="1 つのタグで両方のワークフローが動きますが、Native Node パッケージの npm 公開は手動のままです。"
  :layers="[
  { title: 'release.yml（タグ起点）', nodes: [
    { label: 'publish-npm', note: 'Trusted publishing' },
    { label: 'build-cli', note: 'CLI をビルド' },
    { label: 'python-wheel', note: 'wheel をビルド' },
    { label: 'publish-pypi', note: 'Trusted publishing' },
    { label: 'attach-cli', note: 'Release に CLI を添付' }
  ] },
  { title: 'prebuild.yml（同じタグ）', nodes: [
    { label: 'Native Node マトリクス', note: 'プラットフォーム別に事前ビルド' },
    { label: 'release-bundle', note: 'formulon-native-bundle を作成' }
  ] },
  { title: '結果', nodes: [
    { label: 'npm と PyPI のパッケージ', note: 'release.yml が公開' },
    { label: 'GitHub Release', note: 'CLI バイナリを添付' },
    { label: 'Native Node バンドル', note: 'npm 公開は手動', tone: 'alt' }
  ] }
]" />

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ 各テストターゲットの守備範囲
- [サイズ上限](/ja/development/size-budgets) ─ WASM の上限
- [互換性モデル](/ja/compatibility/model) ─ 互換性説明の根拠
