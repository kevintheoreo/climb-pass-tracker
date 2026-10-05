# Performance

Measured on the production build (`npm run build`, then `npm run preview`), October 2026. Targets (PRD section 9): the main screen is usable within **2 s on first load** and **1 s on repeat visits**, on a mid-range phone over 4G.

## Results

| What | Setting | Result | Target |
| --- | --- | --- | --- |
| First visit, Lighthouse | typical 4G (9 Mbps, 170 ms round trip), CPU 4× slower | first paint and main content **1.5 s**, interactive 1.6 s | 2 s ✅ |
| First visit, Lighthouse | Lighthouse's "slow 4G" (1.6 Mbps, 150 ms), CPU 4× slower | first paint 1.8 s, main content **2.1 s**, interactive 2.1 s | 2 s (0.1 s over, on a deliberately slow link) |
| Repeat visit (app cached by the service worker) | typical 4G, CPU 4× slower | first paint **0.13 to 0.19 s**, form on screen about 0.2 s | 1 s ✅ |

Lighthouse scores (slow 4G): performance 98, accessibility 100, best practices 100, SEO 100. Blocking time 10 ms, no layout shift.

Live site (https://climbpasstracker.netlify.app, Netlify's edge over HTTP/2): the main script is 160 KB with Brotli (166 KB with gzip), the page 1 KB, the stylesheet 6 KB, and the first byte of the page arrives in about 0.2 s from the build machine. Lighthouse could not be pointed at the live address from the build sandbox (its network proxy uses a certificate Chrome does not trust there), so the timings above are from the identical build served locally; the live site is no heavier than that.

What is downloaded on a first visit: about 199 KB in all, of which 167 KB is JavaScript (compressed). Netlify compresses with Brotli, which is smaller still. Minified, the JavaScript is react-dom 204 KB, Dexie 93 KB, zod 89 KB, react-router 37 KB, and the app's own code about 75 KB. After the first visit nothing needs the network.

## What was done

- Settings, the privacy policy and the terms load only when opened (about 20 KB less in the first download).
- `public/robots.txt` is a real file. Before, the single-page fallback answered that address with the app, and Lighthouse reported 138 errors (SEO 91).
- The iPhone launch screens are not in the offline cache.

## Not done

- Replacing zod with `zod/mini` would save about 20 KB compressed (roughly 0.1 s on the slowest link) but means rewriting every schema, which is where the record rules live. Not worth the risk for now.
- Inlining the CSS would not help: the 6 KB file arrives long before the 167 KB script that draws the screen.

## How to measure again

```
npm run build
npm run preview -- --port 4173 --strictPort
# in another terminal (CHROME_PATH is a Chromium or Chrome binary):
npx lighthouse http://localhost:4173/ --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo        # Lighthouse's default: slow 4G
npx lighthouse http://localhost:4173/ --chrome-flags="--headless=new --no-sandbox" --only-categories=performance \
  --throttling.rttMs=170 --throttling.throughputKbps=9000 --throttling.cpuSlowdownMultiplier=4   # typical 4G
```

The repeat visit was timed in Playwright with Chrome's network and CPU throttling (9 Mbps, 170 ms, CPU 4×): visit once, wait for the service worker, then reload and read the paint times. A simulated run is a guide, not a real phone: please also time the first and repeat load on a real phone.
