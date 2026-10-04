import { useEffect, useState } from 'react'
import { buttonClass } from '../../components/formUtils'
import { protectionOf, type Protection } from '../../domain/install'
import { browserPlatform, isStandalone, promptInstall, useCanPromptInstall } from './env'
import { IosSteps } from './InstallPrompt'

/** Does the browser promise to keep this site's data? Only asks; the app requests it at start. */
async function browserKeepsData(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) === true
  } catch {
    return false
  }
}

/**
 * Says whether the browser may delete the person's passes, and what to do about it (D40). The
 * backup file is the safety net either way, so the warning points at it too.
 */
export function StorageStatus() {
  const [protection, setProtection] = useState<Protection | null>(null)
  const [platform] = useState(browserPlatform)
  const canPrompt = useCanPromptInstall()

  useEffect(() => {
    let cancelled = false
    void browserKeepsData().then((persisted) => {
      if (!cancelled) setProtection(protectionOf({ standalone: isStandalone(), persisted }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (protection === null) return null

  if (protection !== 'at-risk') {
    return (
      <p role="status" className="mb-4 text-base text-green-800 dark:text-green-300">
        <span aria-hidden="true">✓ </span>
        {protection === 'installed'
          ? 'Installed as an app. Your phone does not clean up its data behind your back.'
          : 'Your browser has promised to keep this data.'}
      </p>
    )
  }

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-600 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-950"
    >
      <p className="text-base font-semibold">Your passes could be erased by your browser</p>
      <p className="mb-3 mt-1 text-base">
        {platform === 'ios'
          ? 'Safari can erase a website’s data if you don’t open it for about a week.'
          : 'A browser can erase a website’s data when the phone is short of space.'}{' '}
        Add the app to your home screen to keep it safe, and download a backup file now and then.
      </p>
      {platform === 'ios' && <IosSteps />}
      {platform !== 'ios' && canPrompt && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className={buttonClass('primary')}
        >
          Install the app
        </button>
      )}
    </div>
  )
}
