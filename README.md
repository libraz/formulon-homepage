# Formulon Homepage

Documentation site for [Formulon](https://github.com/libraz/formulon).
Deployed at <https://formulon.libraz.net>.

The stack intentionally matches `go-oidc-provider-homepage`:

- VitePress
- Biome
- Node 22 via mise
- Yarn 4
- `node-modules` linker

## Development

```sh
yarn install
yarn dev
```

Normal installs use pinned registry packages and do not need sibling repositories or `vendor/`. To preview unreleased source, stage both WASM variants in `../formulon`, install dependencies in `../formulon-cell`, then prepare the ignored demo packages:

```sh
yarn demos:prepare
yarn dev:local
yarn test:local
yarn build:local
```

The local commands verify the snapshot archives and use them through Vite aliases. They do not change the registry dependency pins or lockfile.

## Checks

```sh
yarn lint
yarn test
yarn build
```

English is the primary documentation language. Japanese pages mirror the page tree under `src/ja/`.

