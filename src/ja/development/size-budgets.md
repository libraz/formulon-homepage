# サイズ予算

ブラウザユーザーは byte ごとにコストを払うため、WASM パッケージにはサイズ予算があります。Native Node / Python / CLI は同じ厳格さでは制限しませんが（200 KB 増えてもユーザーに見えづらい環境向け）、WASM ビルドが core 全体の依存方針を決めます。

::: info 用語: size budget
target 別の成果物サイズ上限。ceiling を超えるとビルド失敗、target を超えると警告で要調査。CI では `make size-check` で検査します。
:::

::: info 用語: Brotli と uncompressed
*uncompressed* はディスク上の WASM ファイルサイズ。*Brotli* は適切に設定された CDN がブラウザに配信する圧縮後サイズ。ユーザーに見えるのは Brotli の数値で、uncompressed は Brotli を配信できないホストでもロード可能にする上限です。
:::

| 対象 | 予算 |
| --- | --- |
| Uncompressed | 目標 1.65 MB / 上限 1.8 MB |
| Brotli | 目標 530 KB / 上限 600 KB |

## 「予算化」が意味すること

予算違反はプロダクトの不具合と同じ扱いです。engine に依存を追加する前にビルドサイズを測り、その機能が支払いに見合うか判断します。「あとで直す」は出荷済みバイナリでは通用しません ─ ユーザーはすでに byte を払い終えています。

## サイズを減らすには

ceiling に近づいたら、次の順で見ます。

1. **使われていない新コードパス**: ほとんどのワークブックが触らない関数族は lazy-dispatch にできる。
2. **依存の見直し**: 汎用ライブラリは魅力的だが、重複排除後でも採算が合わないことが多い。スプレッドシート固有のごく小さなヘルパは in-tree が有利。
3. **ビルドフラグの調整**: Emscripten の optimization pass、LTO、dead-code elimination。
4. **公開 surface の縮小**: export したシンボルは engine が依存を保持し続ける原因になる。internal にできる API は internal に。

## ビルド出力の読み方

```sh
make wasm
make size-check
```

`size-check` は現状の uncompressed と Brotli サイズを出し、予算と比較します。PR を送る前にローカルで通しておけば、CI 側で同じ検査が通ります。

## 次に読むもの

- [ソースからビルド](/ja/development/build-from-source) ─ WASM 成果物の作り方
- [C++ core](/ja/development/core) ─ 依存を小さく保つ理由
- [アーキテクチャ](/ja/development/architecture) ─ 予算内に収めるべき engine の範囲
