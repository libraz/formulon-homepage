# Formulon Homepage

Documentation site for [Formulon](https://github.com/libraz/formulon).
Deployed at <https://formulon.libraz.net>.

The stack intentionally matches `go-oidc-provider-homepage`:

- VitePress
- Biome
- Node 22 via Volta
- Yarn 4
- `node-modules` linker

## Development

```sh
yarn install
yarn dev
```

## Checks

```sh
yarn lint
yarn build
```

English is the primary documentation language. Japanese pages live under `src/ja/` with matching structure for core navigation pages.

