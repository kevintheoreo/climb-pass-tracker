import { repo } from '../../db'
import { backupFilename, backupToText } from '../../domain/backup'
import { todayLocal } from '../../domain/dates'
import { downloadTextFile } from './download'

/**
 * Writes the backup file and hands it to the browser as a download, then notes the time so the
 * reminder (D47) knows. Returns how many passes it holds.
 */
export async function downloadBackupFile(): Promise<number> {
  const backup = await repo.exportBackup()
  downloadTextFile(backupFilename(todayLocal()), backupToText(backup), 'application/json')
  await repo.markBackedUp()
  return backup.passes.filter((p) => p.deletedAt === null).length
}
