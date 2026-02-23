/**
 * scripts/build-icons.mjs
 *
 * Generates all icon formats required by electron-builder from resources/icon.svg:
 *   resources/icon.icns  — macOS (generated via Apple's iconutil CLI)
 *   resources/icon.ico   — Windows (generated via png-to-ico)
 *   resources/icon.png   — Linux (1024×1024 PNG)
 *
 * Requires macOS for iconutil (.icns step).
 * Run with:  npm run icons
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resourcesDir = join(root, 'resources')
const svgPath = join(resourcesDir, 'icon.svg')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderPng(svgData, size) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
  })
  return resvg.render().asPng()
}

function log(msg) {
  process.stdout.write(`  ${msg}\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\nBuilding Vessel icons from resources/icon.svg...\n')

const svgData = readFileSync(svgPath)

// ── 1. Linux: 1024×1024 PNG ──────────────────────────────────────────────────
const png1024 = renderPng(svgData, 1024)
writeFileSync(join(resourcesDir, 'icon.png'), png1024)
log('icon.png          (1024×1024, Linux)')

// ── 2. Windows: .ico (multi-resolution) ──────────────────────────────────────
// ico format supports multiple sizes baked into one file.
// We embed 16, 32, 48, 64, 128, 256 to cover all Windows DPI scenarios.
const icoSizes = [16, 32, 48, 64, 128, 256]
const icoPngBuffers = icoSizes.map((s) => renderPng(svgData, s))

const icoBuffer = await pngToIco(icoPngBuffers)
writeFileSync(join(resourcesDir, 'icon.ico'), icoBuffer)
log(`icon.ico          (${icoSizes.join('×, ')}× — Windows)`)

// ── 3. macOS: .icns via iconutil ─────────────────────────────────────────────
// iconutil expects an .iconset folder containing PNG files named exactly:
//   icon_<size>x<size>.png  and  icon_<size>x<size>@2x.png
// The @2x files are just the double-resolution version of each size.
//
// Standard sizes for a complete .icns:
//   16, 32, 128, 256, 512 (each × 2 for @2x)
const icnsIconset = join(resourcesDir, 'icon.iconset')
mkdirSync(icnsIconset, { recursive: true })

const icnsSizes = [16, 32, 128, 256, 512]
for (const size of icnsSizes) {
  // 1× version
  const buf1x = renderPng(svgData, size)
  writeFileSync(join(icnsIconset, `icon_${size}x${size}.png`), buf1x)
  // 2× version (double resolution, still labelled as the logical size)
  const buf2x = renderPng(svgData, size * 2)
  writeFileSync(join(icnsIconset, `icon_${size}x${size}@2x.png`), buf2x)
}

execSync(`iconutil -c icns "${icnsIconset}" -o "${join(resourcesDir, 'icon.icns')}"`)

// Clean up the temporary iconset folder
rmSync(icnsIconset, { recursive: true, force: true })

log('icon.icns         (16–1024 px, macOS)')

console.log('\nAll icons written to resources/\n')
