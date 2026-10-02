/** How to put the app on the home screen (FR-49). The browser does the installing. */
export function InstallHelp() {
  return (
    <section aria-labelledby="install-heading" className="mb-6">
      <h2 id="install-heading" className="mb-1 text-lg font-semibold">
        Add to your home screen
      </h2>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Installed, the app opens like any other and works without a connection.
      </p>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-1 text-base font-medium">iPhone or iPad (Safari)</h3>
          <ol className="list-decimal space-y-1 pl-5 text-base">
            <li>Tap the Share button.</li>
            <li>Scroll down and tap “Add to Home Screen”.</li>
            <li>Tap “Add”.</li>
          </ol>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-1 text-base font-medium">Android (Chrome)</h3>
          <ol className="list-decimal space-y-1 pl-5 text-base">
            <li>Tap the ⋮ menu at the top right.</li>
            <li>Tap “Install app” or “Add to Home screen”.</li>
            <li>Tap “Install”.</li>
          </ol>
        </div>
      </div>
    </section>
  )
}
