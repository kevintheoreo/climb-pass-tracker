import { useState } from 'react'
import { buttonClass } from '../../components/formUtils'
import { shouldOfferInstall } from '../../domain/install'
import {
  browserPlatform,
  hideInstallPromptForNow,
  isStandalone,
  promptInstall,
  useCanPromptInstall,
  useInstallPromptHidden,
} from './env'

/** The three steps for an iPhone, which has no install button (FR-49). */
export function IosSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-base">
      <li>Tap the Share button in Safari.</li>
      <li>Scroll down and tap “Add to Home Screen”.</li>
      <li>Tap “Add”, then open the app from your home screen.</li>
    </ol>
  )
}

/**
 * Asks the person to put the app on the home screen (D40). Passes are saved only on the
 * phone, and Safari can erase a website's data after about a week without a visit; an installed
 * app is not cleaned up that way. It is there from the first visit, before any pass, because on an
 * iPhone the installed app does not see what was saved in a Safari tab. "Not now" hides it until
 * the app is opened again (Settings keeps the status and the steps).
 */
export function InstallPrompt() {
  const dismissed = useInstallPromptHidden()
  const canPrompt = useCanPromptInstall()
  const [platform] = useState(browserPlatform)
  const [standalone] = useState(isStandalone)

  if (!shouldOfferInstall({ standalone, dismissed, platform, canPrompt })) return null

  return (
    <section
      aria-labelledby="install-prompt-heading"
      className="mb-4 rounded-lg border border-brand-500 bg-brand-100 p-4 dark:border-brand-500 dark:bg-brand-950"
    >
      <h2 id="install-prompt-heading" className="text-base font-semibold">
        This app was designed to be installed on your home screen.
      </h2>
      <p className="mb-3 mt-1 text-base">
        The installed app will keep your entries safely in your phone’s storage.
      </p>
      {platform === 'ios' && <IosSteps />}
      <div className="mt-3 flex flex-wrap gap-3">
        {platform !== 'ios' && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className={buttonClass('primary')}
          >
            Install the app
          </button>
        )}
        <button
          type="button"
          onClick={hideInstallPromptForNow}
          className={buttonClass('secondary')}
        >
          Not now
        </button>
      </div>
    </section>
  )
}
