# 開発

このセクションはコントリビュータとメンテナ向けです。ビルド、テスト、Oracle データの更新、実装の場所を確認する手順をまとめています。

::: tip アーキテクチャより作業手順から始める
多くのコントリビュータは [ソースからビルド](/ja/development/build-from-source) と [テストマトリクス](/ja/development/test-matrix) から始めるのが最短です。アーキテクチャは、どの API / 関数群を変更するか分かってから読む方が役に立ちます。
:::

## 作業手順

| タスク | ページ |
| --- | --- |
| ローカルでビルドする | [ソースからビルド](/ja/development/build-from-source) |
| テストを実行する | [テストマトリクス](/ja/development/test-matrix) |
| Excel の Oracle データを追加する | [Oracle データの提供](/ja/development/oracle-contribution) |

## コードマップ

| 領域 | 参照先 |
| --- | --- |
| C++ 計算コア | [C++ コア](/ja/development/core) |
| 実行環境ごとのバインディング | [バインディング](/ja/development/bindings) |
| 内部構造 | [アーキテクチャ](/ja/development/architecture) |
| ブラウザ向けパッケージのサイズ | [サイズ上限](/ja/development/size-budgets) |
| リリース作業 | [リリースチェックリスト](/ja/development/release-checklist) |

Formulon の開発では再現性を重視します。同じコアのリビジョンから各実行環境をパッケージし、Oracle データを更新し、許容する差分を記録し、実行環境間の結果一致を確認します。
