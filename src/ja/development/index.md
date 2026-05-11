# 開発

このセクションは contributor / maintainer 向けです。ビルド、テスト、oracle data 更新、実装詳細の入口に絞ります。

::: tip アーキテクチャより作業手順から始める
多くの contributor は [ソースからビルド](/ja/development/build-from-source) と [テストマトリクス](/ja/development/test-matrix) から始めるのが最短です。アーキテクチャは、どの API surface / 関数群を変更するか分かってから読む方が役に立ちます。
:::

## 作業手順

| タスク | ページ |
| --- | --- |
| ローカルでビルドする | [ソースからビルド](/ja/development/build-from-source) |
| テストを実行する | [テストマトリクス](/ja/development/test-matrix) |
| Excel 由来の期待値を追加する | [Oracle 提供](/ja/development/oracle-contribution) |

## コードマップ

| 領域 | 参照先 |
| --- | --- |
| C++ 計算 core | [C++ core](/ja/development/core) |
| 実行環境ごとの binding | [バインディング](/ja/development/bindings) |
| 内部構造 | [アーキテクチャ](/ja/development/architecture) |
| ブラウザ向けパッケージのサイズ | [サイズ予算](/ja/development/size-budgets) |
| リリース作業 | [リリースチェックリスト](/ja/development/release-checklist) |

Formulon の開発運用では再現性を重視します。同じ core revision から package surface を作り、oracle data を更新し、許容する差分を記録し、実行環境間の結果一致を確認します。
