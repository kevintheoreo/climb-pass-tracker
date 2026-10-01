/**
 * Asks the browser not to clear this site's data under storage pressure. This matters most for
 * people who never sign in: their passes live only on the device (FR-36, FR-42). Browsers may
 * decline (Safari browser tabs usually do; an installed app is more likely to be granted), so the
 * result is informational and the app must work either way. Never throws.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage
    if (!storage?.persist) return false
    if (storage.persisted && (await storage.persisted())) return true
    return await storage.persist()
  } catch {
    return false
  }
}
