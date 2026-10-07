import { StorageStatus } from '../install/StorageStatus'
import { BackupControls } from './BackupControls'

/**
 * The backup section, first on the Settings screen: where the data lives, then the ways to keep a
 * copy (a file, or the optional Dropbox) (FR-42, FR-62, FR-78). Deleting everything is its own
 * section at the bottom (`DeleteAllData`).
 */
export function DataSettings() {
  return (
    <section aria-labelledby="data-heading" className="mb-6">
      <h2 id="data-heading" className="mb-1 text-lg font-semibold">
        Backup
      </h2>
      <p className="mb-4 text-base">
        Your passes are saved <strong>only on this device</strong>, with no account. Keep a copy to
        move to a new phone or to get them back if this one is lost.
      </p>

      <StorageStatus />

      <BackupControls />
    </section>
  )
}
