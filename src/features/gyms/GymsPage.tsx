import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../../components/Page'
import { buttonClass } from '../../components/formUtils'
import { searchGyms } from '../../domain/gyms'
import { useGymData } from './useGymData'

export default function GymsPage() {
  const data = useGymData()
  const [query, setQuery] = useState('')

  if (!data) return <Page title="Gyms" />

  const results = searchGyms(data.gyms, query)
  const typed = query.trim()

  return (
    <Page title="Gyms">
      <div className="mb-4">
        <label htmlFor="gym-search" className="mb-1 block text-sm font-medium">
          Search gyms
        </label>
        <input
          id="gym-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Gym name"
          autoComplete="off"
          className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {results.length > 0 ? (
        <ul className="mb-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {results.map((gym) => {
            const count = data.counts[gym.ref.id] ?? 0
            return (
              <li key={`${gym.ref.kind}:${gym.ref.id}`}>
                <Link
                  to={`/gyms/${gym.ref.kind}/${gym.ref.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                >
                  <span>
                    <span className="block font-medium">{gym.name}</span>
                    <span className="block text-sm text-slate-600 dark:text-slate-400">
                      {count === 0
                        ? 'No active passes'
                        : count === 1
                          ? '1 active pass'
                          : `${count} active passes`}
                      {gym.ref.kind === 'user' && ' · Added by you'}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ›
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          {typed ? `No gyms match “${typed}”.` : 'No gyms yet.'}
        </p>
      )}

      <Link
        to={typed ? `/gyms/new?name=${encodeURIComponent(typed)}` : '/gyms/new'}
        className={buttonClass(results.length === 0 ? 'primary' : 'secondary')}
      >
        {typed && results.length === 0
          ? `Add “${typed}” as your own gym`
          : "Can't find it? Add your own gym"}
      </Link>
    </Page>
  )
}
