import { db } from './db'
import { createRepo } from './repo'

export { ClimbDB, db } from './db'
export { createRepo, GymInUseError, NotFoundError, type Repo } from './repo'

/** The app-wide repository, backed by the real on-device database. */
export const repo = createRepo(db)
