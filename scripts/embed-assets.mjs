// Empaqueta los archivos de dist/ dentro del Worker (worker/assets.gen.ts).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
}
const root = new URL('../dist', import.meta.url).pathname
const files = {}
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else files['/' + relative(root, p)] = { type: TYPES[extname(p)] ?? 'application/octet-stream', b64: readFileSync(p).toString('base64') }
  }
}
walk(root)
writeFileSync(new URL('../worker/assets.gen.ts', import.meta.url),
  '// Generado por scripts/embed-assets.mjs. No editar.\nexport const ASSETS: Record<string, { type: string; b64: string }> = ' + JSON.stringify(files) + '\n')
console.log(`${Object.keys(files).length} archivos empaquetados`)
