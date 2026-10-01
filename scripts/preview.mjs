import { parseArgs } from 'node:util'
import { serve } from 'vitepress'

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '4173' },
    root: { type: 'string' },
    base: { type: 'string' }
  }
})
const port = Number(values.port)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('--port must be an integer between 1 and 65535')
}

const app = await serve({ port, root: values.root, base: values.base })
// VitePress preview serves through Polka, bypassing Vite's preview headers
// and configurePreviewServer hooks. Set headers before its static handler.
app.server.prependListener('request', (_req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
})
