// Generates placeholder PWA icons from the SVG sources. Replace the SVGs when there is a real logo.
import sharp from 'sharp'

const out = (name, svg, size) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toFile(`public/${name}`)

await Promise.all([
  out('pwa-192.png', 'public/favicon.svg', 192),
  out('pwa-512.png', 'public/favicon.svg', 512),
  out('pwa-512-maskable.png', 'public/favicon-maskable.svg', 512),
  out('apple-touch-icon.png', 'public/favicon-maskable.svg', 180),
])
console.log('icons generated')
