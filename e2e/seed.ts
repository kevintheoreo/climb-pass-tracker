import type { Page } from '@playwright/test'

/**
 * Fills the on-device database with a spread of passes (every type and state), straight into
 * IndexedDB, then reloads. Rows are normally added through the blank row; this is for tests that
 * need many rows quickly. Dates are relative to the browser's today.
 *
 * Rows: 7 / 10 and 3 / 20 at gym A, 2 / 10 (low) at gym B, a class pack 1 / 4 (expiring soon, low),
 * an unlimited membership, a monthly membership 3 / 8, a single entry with no expiry; and in
 * Finished a used-up pack and an expired pack with 6 unused.
 */
export async function seedSamples(page: Page) {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Gym' }).waitFor()
  await page.evaluate(async () => {
    const day = (offset: number) => {
      const d = new Date()
      d.setDate(d.getDate() + offset)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const stamp = new Date().toISOString()
    let n = 0
    const meta = () => ({ id: `seed-${++n}`, createdAt: stamp, updatedAt: stamp, deletedAt: null })
    const gymA = { kind: 'builtin', id: '0859db82-c520-4f55-8b0a-0e7362d8f2fe' }
    const gymB = { kind: 'builtin', id: 'aad09cb6-fb53-401f-879a-caa3db961169' }
    const zig = { ...meta(), name: 'Zig Zag Wall' }
    const gymZ = { kind: 'user', id: zig.id }
    const base = { priceCents: null, comments: null }
    const counted = (
      gymRef: object,
      total: number,
      used: number,
      expiry: number,
      type = 'multipass',
    ) => ({
      ...meta(),
      ...base,
      gymRef,
      passType: type,
      purchaseDate: day(-60),
      expiryDate: day(expiry),
      totalEntries: total,
      initialUsed: used,
    })
    const passes = [
      counted(gymA, 10, 3, 120),
      counted(gymA, 20, 17, 45),
      counted(gymB, 10, 8, 200),
      { ...counted(gymB, 4, 3, 10, 'class_pack'), purchaseDate: day(-30) },
      {
        ...meta(),
        ...base,
        gymRef: gymB,
        passType: 'membership',
        purchaseDate: day(-20),
        expiryDate: day(20),
        monthlyEntries: null,
        resetDay: null,
      },
      {
        ...meta(),
        ...base,
        gymRef: gymZ,
        passType: 'membership',
        purchaseDate: day(-17),
        expiryDate: day(300),
        monthlyEntries: 8,
        resetDay: null,
      },
      {
        ...meta(),
        ...base,
        gymRef: gymZ,
        passType: 'single_entry',
        purchaseDate: day(0),
        expiryDate: null,
        totalEntries: 1,
        initialUsed: 0,
      },
      counted(gymA, 5, 5, 30),
      counted(gymZ, 10, 4, -10),
    ]
    const monthly = passes[5]!
    const uses = Array.from({ length: 5 }, () => ({ ...meta(), passId: monthly.id, usedAt: stamp }))

    const open = indexedDB.open('climb-pass-tracker')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction(['passes', 'uses', 'userGyms'], 'readwrite')
    passes.forEach((p) => tx.objectStore('passes').add(p))
    uses.forEach((u) => tx.objectStore('uses').add(u))
    tx.objectStore('userGyms').add(zig)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  await page.reload()
}

/**
 * Opens the blank row when it is hidden behind the "Add a pass" button (it is, once there is an
 * active pass), and does nothing when it is already on screen.
 */
export async function openAddRow(page: Page) {
  const button = page.getByRole('button', { name: 'Add a pass' })
  const gym = page.getByRole('combobox', { name: 'Gym' })
  await button.or(gym).waitFor() // the screen may still be loading
  if (await button.isVisible()) await button.click()
  await gym.waitFor()
}
