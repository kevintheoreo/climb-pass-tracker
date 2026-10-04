import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { shouldOfferInstall } from '../../domain/install'
import { browserPlatform, isStandalone, promptInstall, useCanPromptInstall } from './env'

const DISMISSED = 'installPromptDismissed'

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
 * Asks the person, once, to put the app on the home screen (D40). Passes are saved only on the
 * phone, and Safari can erase a website's data after about a week without a visit; an installed
 * app is not cleaned up that way. It is there from the first visit, before any pass, because on an
 * iPhone the installed app does not see what was saved in a Safari tab. It stays away for good
 * once dismissed (Settings keeps the status and the steps).
 */
export function InstallPrompt() {
  const dismissed = useLiveQuery(async () => (await repo.getMeta(DISMISSED)) === true, [])
  const canPrompt = useCanPromptInstall()
  const [platform] = useState(browserPlatform)
  const [standalone] = useState(isStandalone)

  if (
    dismissed === undefined ||
    !shouldOfferInstall({ standalone, dismissed, platform, canPrompt })
  ) {
    return null
  }

  const dismiss = () => void repo.setMeta(DISMISSED, true)
  return (
    <section
      aria-labelledby="install-prompt-heading"
      className="mb-4 rounded-lg border border-teal-700 bg-teal-50 p-4 dark:border-teal-500 dark:bg-teal-950"
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
        <button type="button" onClick={dismiss} className={buttonClass('secondary')}>
          Not now
        </button>
      </div>
    </section>
  )
}
