import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal, type LocalDate } from '../../domain/dates'
import type { PassInput } from '../../domain/types'

/**
 * PREVIEW ONLY — removed in step 1.8, when rows can be added by hand. Adds a spread of passes
 * (every type and state) so the main screen can be tried on a Netlify preview. Reached through
 * `?sample` in the address.
 */
export async function addSamplePasses(today: LocalDate = todayLocal()): Promise<void> {
  const day = (offset: number) => addDays(today, offset)
  const boulder = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const
  const climbing = { kind: 'builtin', id: BUILTIN_GYMS[1]!.id } as const
  const zigzag = (await repo.findOrCreateGym('Zig Zag Wall')).ref
  const base = { priceCents: null, comments: null }

  const multipass = (gymRef: PassInput['gymRef'], total: number, used: number, expiry: number) =>
    ({
      ...base,
      gymRef,
      passType: 'multipass',
      purchaseDate: day(-60),
      expiryDate: day(expiry),
      totalEntries: total,
      initialUsed: used,
    }) as PassInput

  await repo.createPass(multipass(boulder, 10, 3, 120)) //            7 / 10
  await repo.createPass(multipass(boulder, 20, 17, 45)) //            3 / 20, same gym, second pack
  await repo.createPass(multipass(climbing, 10, 8, 200)) //           2 / 10, low
  await repo.createPass({
    ...base,
    gymRef: climbing,
    passType: 'class_pack',
    purchaseDate: day(-30),
    expiryDate: day(10),
    totalEntries: 4,
    initialUsed: 3,
  } as PassInput) //                                                  1 / 4, expiring soon and low
  await repo.createPass({
    ...base,
    gymRef: climbing,
    passType: 'membership',
    purchaseDate: day(-20),
    expiryDate: day(20),
    monthlyEntries: null,
    resetDay: null,
  } as PassInput) //                                                  Unlimited
  await repo.createPass(
    {
      ...base,
      gymRef: zigzag,
      passType: 'membership',
      purchaseDate: day(-17),
      expiryDate: day(300),
      monthlyEntries: 8,
      resetDay: null,
    } as PassInput,
    { usedThisPeriod: 5, today },
  ) //                                                                3 / 8, resets monthly
  await repo.createPass({
    ...base,
    gymRef: zigzag,
    passType: 'single_entry',
    purchaseDate: today,
    expiryDate: null,
    totalEntries: 1,
    initialUsed: 0,
  } as PassInput) //                                                  1 / 1, no expiry
  await repo.createPass(multipass(boulder, 5, 5, 30)) //              used up (Finished)
  await repo.createPass(multipass(zigzag, 10, 4, -10)) //             expired, 6 unused (Finished)
}
