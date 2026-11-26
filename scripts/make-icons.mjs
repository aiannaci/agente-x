// Genera los íconos PNG de la PWA a partir de public/favicon.svg (usa Playwright/Chromium).
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()

async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  // Maskable: fondo a sangre y robot dentro de la zona segura (80%).
  const inner = maskable
    ? `<div style="width:100%;height:100%;background:linear-gradient(135deg,#3B4BDB,#C255CF);display:grid;place-items:center">
         <div style="width:78%;height:78%">${svg.replace('rx="15"', 'rx="0"')}</div></div>`
    : svg
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px">${inner}</div>
    <style>svg{width:100%;height:100%;display:block}</style></body></html>`)
  await page.locator('body > div').screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: true })
}

await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-maskable-512.png', { maskable: true })
await render(180, 'apple-touch-icon.png', { maskable: true })
await browser.close()
console.log('Íconos generados')
