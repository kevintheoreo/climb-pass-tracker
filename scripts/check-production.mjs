// Checks a deployed copy of the app (the live site, or a Netlify deploy preview) after a release.
//
//   npm run build                                   # the same commit that was deployed
//   node scripts/check-production.mjs https://climbpasstracker.netlify.app
//
// It confirms the site serves this build's files, every address answers, the files have the right type
// and caching, and the security headers are there. Needs Node 22 or newer. Exits 1 if anything is wrong.
import { readFile } from 'node:fs/promises'

const base = (process.argv[2] ?? 'https://climbpasstracker.netlify.app').replace(/\/$/, '')
const results = []
const check = (ok, what, detail = '') => results.push({ ok, what, detail })

const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' })
const header = (res, name) => res.headers.get(name) ?? ''

// 1. This build is what is live: the page names the same script and style files.
const built = await readFile('dist/index.html', 'utf8').catch(() => null)
const home = await get('/')
const html = await home.text()
const assets = (text) => [...text.matchAll(/assets\/[\w.-]+\.(?:js|css)/g)].map((m) => m[0]).sort()
if (built === null) check(false, 'dist/index.html exists (run npm run build first)')
else {
  const [mine, live] = [assets(built), assets(html)]
  check(
    mine.length > 0 && mine.join() === live.join(),
    'the live site serves this build',
    `local ${mine.join(' ')} / live ${live.join(' ')}`,
  )
}

// 2. Every address answers with the right kind of file.
const pages = ['/', '/settings', '/privacy', '/terms', '/some/unknown/address']
for (const path of pages) {
  const res = await get(path)
  check(res.status === 200 && /text\/html/.test(header(res, 'content-type')), `${path} is the app`)
}
const files = [
  ['/robots.txt', /text\/plain/],
  ['/manifest.webmanifest', /application\/manifest\+json/],
  ['/pwa-192.png', /image\/png/],
  ['/pwa-512.png', /image\/png/],
  ['/pwa-512-maskable.png', /image\/png/],
  ['/apple-touch-icon.png', /image\/png/],
  ['/favicon-32.png', /image\/png/],
  ['/splash/light-1179x2556.png', /image\/png/],
  ['/splash/dark-1179x2556.png', /image\/png/],
  ['/sw.js', /javascript/],
  ['/registerSW.js', /javascript/],
]
for (const [path, type] of files) {
  const res = await get(path)
  check(
    res.status === 200 && type.test(header(res, 'content-type')),
    `${path} is served as ${type.source.replace(/\\/g, '')}`,
  )
}
const robots = await (await get('/robots.txt')).text()
check(/User-agent:\s*\*/i.test(robots) && !/<html/i.test(robots), '/robots.txt is a real file')

// 3. Caching: the service worker and the page always revalidate; the hashed files never change.
check(/no-cache/.test(header(await get('/sw.js'), 'cache-control')), '/sw.js is never cached')
check(
  /no-cache/.test(header(await get('/index.html'), 'cache-control')),
  '/index.html is never cached',
)
const script = assets(html).find((a) => a.endsWith('.js'))
if (script) {
  const res = await get('/' + script, { 'accept-encoding': 'br' })
  check(/immutable/.test(header(res, 'cache-control')), `/${script} is cached for good`)
  check(
    /br|gzip/.test(header(res, 'content-encoding')),
    `/${script} is compressed`,
    header(res, 'content-encoding'),
  )
}

// 4. Security headers.
const csp = header(home, 'content-security-policy')
check(
  /default-src 'none'/.test(csp) && /connect-src 'self'/.test(csp),
  'Content-Security-Policy keeps the app to its own site',
)
check(/nosniff/.test(header(home, 'x-content-type-options')), 'X-Content-Type-Options: nosniff')
check(
  /DENY/.test(header(home, 'x-frame-options')) && /frame-ancestors 'none'/.test(csp),
  'the app cannot be put in a frame',
)
check(/no-referrer/.test(header(home, 'referrer-policy')), 'Referrer-Policy: no-referrer')
check(
  /max-age=\d{6,}/.test(header(home, 'strict-transport-security')),
  'HTTPS only (Strict-Transport-Security)',
)
check(base.startsWith('https://'), 'the address is https')

for (const r of results)
  console.log(`${r.ok ? '✓' : '✗'} ${r.what}${r.ok || !r.detail ? '' : `  [${r.detail}]`}`)
const failed = results.filter((r) => !r.ok).length
console.log(
  failed === 0
    ? `\nAll ${results.length} checks passed for ${base}`
    : `\n${failed} of ${results.length} checks failed for ${base}`,
)
process.exit(failed === 0 ? 0 : 1)
