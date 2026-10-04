import { detectPlatform, protectionOf, shouldOfferInstall } from './install'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

describe('detectPlatform', () => {
  it.each([
    ['an iPhone', IPHONE, 'iPhone', 5, 'ios'],
    ['an iPad asking for the desktop site', MAC, 'MacIntel', 5, 'ios'],
    ['an Android phone', ANDROID, 'Linux armv81', 5, 'android'],
    ['a Mac', MAC, 'MacIntel', 0, 'other'],
    ['a Windows PC', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0, 'other'],
  ] as const)('%s', (_name, userAgent, platform, maxTouchPoints, expected) => {
    expect(detectPlatform({ userAgent, platform, maxTouchPoints })).toBe(expected)
  })
})

describe('protectionOf', () => {
  it('an installed app is safe whatever the browser says', () => {
    expect(protectionOf({ standalone: true, persisted: false })).toBe('installed')
  })
  it('a browser tab is safe only if the browser promised to keep the data', () => {
    expect(protectionOf({ standalone: false, persisted: true })).toBe('kept')
    expect(protectionOf({ standalone: false, persisted: false })).toBe('at-risk')
  })
})

describe('shouldOfferInstall', () => {
  const base = {
    hasPasses: true,
    standalone: false,
    dismissed: false,
    platform: 'ios',
    canPrompt: false,
  } as const

  it('offers the steps on an iPhone, which has no install button', () => {
    expect(shouldOfferInstall(base)).toBe(true)
  })
  it('offers on Android only once the browser has an install prompt ready', () => {
    expect(shouldOfferInstall({ ...base, platform: 'android' })).toBe(false)
    expect(shouldOfferInstall({ ...base, platform: 'android', canPrompt: true })).toBe(true)
  })
  it('does not offer on a computer without an install prompt', () => {
    expect(shouldOfferInstall({ ...base, platform: 'other' })).toBe(false)
  })
  it('waits for a first pass, and never nags an installed or dismissed app', () => {
    expect(shouldOfferInstall({ ...base, hasPasses: false })).toBe(false)
    expect(shouldOfferInstall({ ...base, standalone: true })).toBe(false)
    expect(shouldOfferInstall({ ...base, dismissed: true })).toBe(false)
  })
})
