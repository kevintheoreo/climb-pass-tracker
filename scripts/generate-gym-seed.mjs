// Writes supabase/seed_gyms.sql from the bundled gym list (src/data/gyms.ts).
// Needs Node 22.18 or newer, which can run the .ts files directly.
import { writeFileSync } from 'node:fs'
import { BUILTIN_GYMS } from '../src/data/gyms.ts'
import { gymSeedSql } from '../src/data/gymSeed.ts'

const target = new URL('../supabase/seed_gyms.sql', import.meta.url)
writeFileSync(target, gymSeedSql(BUILTIN_GYMS))
console.log(`Wrote ${BUILTIN_GYMS.length} gyms to supabase/seed_gyms.sql`)
