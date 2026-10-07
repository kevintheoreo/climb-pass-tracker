import { isStandalone } from '../install/env'

/**
 * How to put the app on the home screen (FR-49). The browser does the installing. Closed until
 * asked for, and left out once the app is installed (it matters once).
 */
export function InstallHelp() {
  if (isStandalone()) return null
  return (
    <details className="group mb-6">
      <summary className="flex min-h-11 cursor-pointer items-center text-lg font-semibold">
        <span
          aria-hidden="true"
          className="mr-2 inline-block transition-transform group-open:rotate-90"
        >
          ›
        </span>
        Add to your home screen
      </summary>
      <p className="mb-3 mt-1 text-sm text-stone-600 dark:text-stone-400">
        Installed, the app opens like any other and works without a connection.
      </p>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-1 text-base font-medium">iPhone or iPad (Safari)</h3>
          <ol className="list-decimal space-y-1 pl-5 text-base">
            <li>Tap the Share button.</li>
            <li>Scroll down and tap “Add to Home Screen”.</li>
            <li>Tap “Add”.</li>
          </ol>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-1 text-base font-medium">Android (Chrome)</h3>
          <ol className="list-decimal space-y-1 pl-5 text-base">
            <li>Tap the ⋮ menu at the top right.</li>
            <li>Tap “Install app” or “Add to Home screen”.</li>
            <li>Tap “Install”.</li>
          </ol>
        </div>
      </div>
    </details>
  )
}
