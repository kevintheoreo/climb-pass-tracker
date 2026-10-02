import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { Page } from '../../components/Page'
import { buttonClass } from '../../components/formUtils'
import { repo, GymInUseError } from '../../db'
import { templateDetails } from '../../domain/gyms'
import { useGymData } from './useGymData'

export default function GymDetailPage() {
  const { kind, id = '' } = useParams()
  const navigate = useNavigate()
  const data = useGymData()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!data) return <Page title="Gym" back={{ to: '/gyms', label: 'Gyms' }} />

  const gym = data.allGyms.find((g) => g.ref.kind === kind && g.ref.id === id)
  if (!gym) {
    return (
      <Page title="Gym not found" back={{ to: '/gyms', label: 'Gyms' }}>
        <p className="text-slate-600 dark:text-slate-400">This gym doesn’t exist any more.</p>
      </Page>
    )
  }

  const base = `/gyms/${gym.ref.kind}/${gym.ref.id}`
  const count = data.counts[gym.ref.id] ?? 0

  async function deleteGym() {
    setDeleteError(null)
    try {
      await repo.deleteUserGym(id)
      navigate('/gyms', { replace: true })
    } catch (error) {
      if (error instanceof GymInUseError) {
        setDeleteError('This gym still has passes. Delete those passes first, then delete the gym.')
      } else {
        throw error
      }
    }
  }

  return (
    <Page title={gym.name} back={{ to: '/gyms', label: 'Gyms' }}>
      <p className="mb-1 text-slate-600 dark:text-slate-400">
        {count === 0
          ? 'No active passes'
          : count === 1
            ? '1 active pass'
            : `${count} active passes`}
      </p>
      {gym.website && (
        <p className="mb-4">
          <a
            href={gym.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 underline dark:text-teal-300"
          >
            {gym.website.replace(/^https?:\/\//i, '')}
          </a>
        </p>
      )}

      <h2 className="mb-2 mt-4 text-lg font-semibold">Pass options</h2>
      {gym.templates.length === 0 ? (
        <p className="mb-3 text-slate-600 dark:text-slate-400">No pass options yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {gym.templates.map((t) => {
            const details = templateDetails(t)
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div>
                  <p className="font-medium">{t.name}</p>
                  {details.length > 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {details.join(' · ')}
                    </p>
                  )}
                  {t.comments && (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">
                      {t.comments}
                    </p>
                  )}
                </div>
                {t.source === 'user' && (
                  <Link
                    to={`${base}/templates/${t.id}/edit`}
                    aria-label={`Edit ${[t.name, ...details].join(', ')}`}
                    className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-teal-700 dark:text-teal-300"
                  >
                    Edit
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Link to={`${base}/templates/new`} className={buttonClass('secondary')}>
        Add a pass option
      </Link>

      {gym.ref.kind === 'user' && (
        <section className="mt-8 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h2 className="mb-3 text-lg font-semibold">Manage gym</h2>
          <div className="flex flex-col items-start gap-3">
            <Link to={`/gyms/user/${gym.ref.id}/edit`} className={buttonClass('secondary')}>
              Edit gym
            </Link>
            <ConfirmDelete
              label="Delete gym"
              prompt="Delete this gym and its pass options? This can’t be undone."
              onConfirm={deleteGym}
            />
            {deleteError && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {deleteError}
              </p>
            )}
          </div>
        </section>
      )}
    </Page>
  )
}
