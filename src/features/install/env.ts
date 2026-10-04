import { useSyncExternalStore } from 'react'
import { detectPlatform, type Platform } from '../../domain/install'

/** What this browser says about itself, for `domain/install.ts`. */
export function browserPlatform(): Platform {
  return detectPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  })
}

/** Is the app running as an installed app (opened from the home screen) and not in a browser tab? */
export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

/** Chrome's install prompt, kept until the person taps our own Install button. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let listening = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

/**
 * Starts keeping the browser's install prompt (Chrome on Android and desktop; iPhones have none).
 * Call it once, early: the browser can send it before the screen has loaded.
 */
export function listenForInstallPrompt() {
  if (listening) return
  listening = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // keep it for our own button instead of the browser's mini bar
    deferred = event as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True while the browser has an install prompt ready to show. */
export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null)
}

/** Shows the browser's own install dialog. Resolves when the person has answered it. */
export async function promptInstall(): Promise<void> {
  const event = deferred
  if (!event) return
  deferred = null // a prompt can be used once
  emit()
  await event.prompt()
  await event.userChoice
}

// "Not now" hides the card until the app is opened again: it is kept here, in memory, so it
// survives moving between screens but not a reload or reopening the app.
let hiddenForNow = false

/** True after "Not now", until the page is loaded again. */
export function useInstallPromptHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hiddenForNow)
}

export function hideInstallPromptForNow() {
  hiddenForNow = true
  emit()
}

/** Forgets "Not now", as opening the app again does. For tests. */
export function showInstallPromptAgain() {
  hiddenForNow = false
  emit()
}
