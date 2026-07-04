# サイズ予算

ブラウザユーザーはバイトごとにコストを払うため、WASM パッケージにはサイズ予算があります。Native Node / Python / CLI は同じ厳格さでは制限しませんが（200 KB 増えてもユーザーに見えづらい環境向け）、WASM ビルドがコア全体の依存方針を決めます。

::: info 用語: サイズ予算
target 別の成果物サイズ上限です。上限を超えるとビルド失敗、目標を超えると警告で要調査。CI では `make size-check` で検査します。
:::

::: info 用語: Brotli と非圧縮サイズ
*非圧縮サイズ* はディスク上の WASM ファイルサイズです。*Brotli* は適切に設定された CDN がブラウザに配信する圧縮後サイズです。ユーザーに見えるのは Brotli の数値で、非圧縮サイズは Brotli を配信できないホストでもロード可能にする上限です。
:::

| 対象 | 予算 |
| --- | --- |
| 非圧縮サイズ | 目標 2.5 MB（ソフト上限）/ ハード上限 3.0 MB |
| Brotli | 目標 560 KB / 上限 600 KB |

この上限は v0.9.3 で引き上げられました。OOXML / XLSB / pivot の忠実度向上作業でバイナリが正当に増えた後、機能追加のたびに上限を再調整せずに済むよう、あらかじめ余裕を持たせるためです。現在のビルドは非圧縮でおよそ 2.09 MiB、Brotli で約 560 KiB ─ 目標の範囲内に十分収まっており、ハード上限までまだ約 1 MB の余裕があります。

<svg viewBox="0 0 600 110" width="100%" role="img" aria-label="WASM 非圧縮サイズのゲージ: 現在のビルドは約 2.09 MiB、ソフト上限 2.5 MiB、ハード上限 3.0 MiB">
  <rect x="1" y="40" width="598" height="28" rx="6" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" />
  <rect x="1" y="40" width="418" height="28" rx="6" fill="var(--vp-c-brand-1)" />
  <line x1="500" y1="32" x2="500" y2="76" stroke="var(--vp-c-text-2)" stroke-width="2" stroke-dasharray="4 3" />
  <line x1="597" y1="32" x2="597" y2="76" stroke="var(--vp-c-text-1)" stroke-width="2" />
  <text x="4" y="26" font-size="12" fill="var(--vp-c-text-3)">0 MiB</text>
  <text x="500" y="26" text-anchor="middle" font-size="12" fill="var(--vp-c-text-2)">ソフト上限 2.5 MiB</text>
  <text x="596" y="98" text-anchor="end" font-size="12" fill="var(--vp-c-text-1)">ハード上限 3.0 MiB</text>
  <text x="209" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="var(--vp-c-text-1)">現在 約 2.09 MiB</text>
</svg>

## 「予算化」が意味すること

予算違反はプロダクトの不具合と同じ扱いです。エンジンに依存を追加する前にビルドサイズを測り、その機能が支払いに見合うか判断します。「あとで直す」は出荷済みバイナリでは通用しません。ユーザーはすでにバイトを払い終えています。

## サイズを減らすには

上限に近づいたら、次の順で見ます。

1. **使われていない新コードパス**: ほとんどのワークブックが触らない関数族は遅延呼び出しにできる。
2. **依存の見直し**: 汎用ライブラリは魅力的だが、重複排除後でも採算が合わないことが多い。スプレッドシート固有のごく小さなヘルパは in-tree が有利。
3. **ビルドフラグの調整**: Emscripten の optimization pass、LTO、dead-code elimination。
4. **公開 API の縮小**: export したシンボルはエンジンが依存を保持し続ける原因になる。内部 API にできるものは内部に置く。

## ビルド出力の読み方

```sh
make wasm
make size-check
```

`size-check` は現状の非圧縮サイズと Brotli サイズを出し、予算と比較します。PR を送る前にローカルで通しておけば、CI 側で同じ検査が通ります。

## 次に読むもの

- [ソースからビルド](/ja/development/build-from-source) ─ WASM 成果物の作り方
- [C++ コア](/ja/development/core) ─ 依存を小さく保つ理由
- [アーキテクチャ](/ja/development/architecture) ─ 予算内に収めるべきエンジンの範囲
