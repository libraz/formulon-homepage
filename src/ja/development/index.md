# 開発

このセクションはコントリビュータ / メンテナ向けです。ビルド、テスト、Oracle データ更新、実装詳細の入口に絞ります。

::: tip アーキテクチャより作業手順から始める
多くのコントリビュータは [ソースからビルド](/ja/development/build-from-source) と [テストマトリクス](/ja/development/test-matrix) から始めるのが最短です。アーキテクチャは、どの API / 関数群を変更するか分かってから読む方が役に立ちます。
:::

## 作業手順

| タスク | ページ |
| --- | --- |
| ローカルでビルドする | [ソースからビルド](/ja/development/build-from-source) |
| テストを実行する | [テストマトリクス](/ja/development/test-matrix) |
| Excel の Oracle データを追加する | [Oracle 提供](/ja/development/oracle-contribution) |

## コードマップ

| 領域 | 参照先 |
| --- | --- |
| C++ 計算コア | [C++ コア](/ja/development/core) |
| 実行入口ごとのバインディング | [バインディング](/ja/development/bindings) |
| 内部構造 | [アーキテクチャ](/ja/development/architecture) |
| ブラウザ向けパッケージのサイズ | [サイズ予算](/ja/development/size-budgets) |
| リリース作業 | [リリースチェックリスト](/ja/development/release-checklist) |

Formulon の開発運用では再現性を重視します。同じコア revision から各実行入口をパッケージし、Oracle データを更新し、許容する差分を記録し、実行入口間の結果一致を確認します。
