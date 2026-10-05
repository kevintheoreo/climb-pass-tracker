// Generates every app icon and the iPhone launch screens from the owner's artwork,
// design/icon-source.png (an orange tile with a fist holding a ticket).
//
//   node scripts/generate-icons.mjs
//
// The artwork is cut out of its tile (the tile is slightly taller than it is wide, so it cannot be
// used as it is) and rebuilt on flat brand orange at each size:
//   public/pwa-192.png, pwa-512.png        rounded tile (purpose "any")
//   public/pwa-512-maskable.png            full-bleed, artwork inside the safe circle
//   public/apple-touch-icon.png            full-bleed (iOS rounds it itself)
//   public/favicon-32.png                  rounded tile for the browser tab
//   public/splash/*.png                    iPhone launch screens, light and dark (the block between
//                                          the "splash" markers in index.html is rewritten to match)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const ORANGE = { r: 0xe8, g: 0x65, b: 0x33, alpha: 1 } // #E86533, the app's main colour
const LIGHT_BG = { r: 0xff, g: 0xf7, b: 0xe8, alpha: 1 } // #FFF7E8, the app's light background
const DARK_BG = { r: 0x0c, g: 0x0a, b: 0x09, alpha: 1 } // #0C0A09 (stone-950), the dark background

// Where the artwork sits in design/icon-source.png (found by scanning for non-orange pixels).
const ART = { left: 385, top: 270, width: 466, height: 721 }
const PAD = 6

async function cutOutArtwork() {
  const { data, info } = await sharp('design/icon-source.png')
    .extract({
      left: ART.left - PAD,
      top: ART.top - PAD,
      width: ART.width + 2 * PAD,
      height: ART.height + 2 * PAD,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  // The source's orange is not perfectly flat: make it see-through so the flat orange shows.
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - 0xe8, data[i + 1] - 0x65, data[i + 2] - 0x33)
    if (d < 24) data[i + 3] = 0
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

const art = await cutOutArtwork()

/** An icon `size` px square. `artHeight` is the artwork's height as a share of the icon. */
async function icon(size, { artHeight, rounded }) {
  const piece = await sharp(art)
    .resize({ height: Math.round(size * artHeight) })
    .toBuffer()
  let image = await sharp({
    create: { width: size, height: size, channels: 4, background: ORANGE },
  })
    .composite([{ input: piece, gravity: 'center' }])
    .png()
    .toBuffer()
  if (rounded) {
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.225)}" fill="#fff"/></svg>`,
    )
    image = await sharp(image)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
  }
  return image
}

const ROUNDED = { artHeight: 0.76, rounded: true }
const FULL_BLEED = { artHeight: 0.68, rounded: false } // inside the maskable safe circle

await writeFile('public/pwa-192.png', await icon(192, ROUNDED))
await writeFile('public/pwa-512.png', await icon(512, ROUNDED))
await writeFile('public/pwa-512-maskable.png', await icon(512, FULL_BLEED))
await writeFile('public/apple-touch-icon.png', await icon(180, FULL_BLEED))
await writeFile('public/favicon-32.png', await icon(32, { artHeight: 0.8, rounded: true }))

// iPhone launch screens: one per screen size, in light and dark (iOS picks by media query).
// [css width, css height, pixel ratio]
const PHONES = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
]
await mkdir('public/splash', { recursive: true })
const links = []
for (const [cw, ch, ratio] of PHONES) {
  const [w, h] = [cw * ratio, ch * ratio]
  const tile = await icon(Math.round(w * 0.28), ROUNDED)
  for (const [scheme, background] of [
    ['light', LIGHT_BG],
    ['dark', DARK_BG],
  ]) {
    const file = `${scheme}-${w}x${h}.png`
    await sharp({ create: { width: w, height: h, channels: 4, background } })
      .composite([{ input: tile, gravity: 'center' }])
      .flatten({ background })
      .png({ compressionLevel: 9, palette: false })
      .toFile(`public/splash/${file}`)
    links.push(
      `    <link rel="apple-touch-startup-image" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})" href="/splash/${file}" />`,
    )
  }
}

const html = await readFile('index.html', 'utf8')
const block = `<!-- splash:start (written by scripts/generate-icons.mjs) -->\n${links.join('\n')}\n    <!-- splash:end -->`
await writeFile('index.html', html.replace(/<!-- splash:start[\s\S]*?<!-- splash:end -->/, block))
console.log('icons and launch screens generated')
