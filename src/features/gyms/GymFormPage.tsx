import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ZodError } from 'zod'
import { Page } from '../../components/Page'
import { TextField } from '../../components/forms'
import { buttonClass, fieldErrors } from '../../components/formUtils'
import { repo } from '../../db'
import { normalizeWebsite } from '../../domain/gyms'

function GymForm({
  gymId,
  initialName,
  initialWebsite,
}: {
  gymId?: string
  initialName: string
  initialWebsite: string
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(initialName)
  const [website, setWebsite] = useState(initialWebsite)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const input = { name, website: normalizeWebsite(website) }
      const gym = gymId ? await repo.updateUserGym(gymId, input) : await repo.addUserGym(input)
      navigate(`/gyms/user/${gym.id}`, { replace: true })
    } catch (error) {
      if (error instanceof ZodError) setErrors(fieldErrors(error))
      else throw error
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <TextField
        label="Gym name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoComplete="off"
        required
      />
      <TextField
        label="Website (optional)"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        error={errors.website}
        inputMode="url"
        autoCapitalize="none"
        autoComplete="off"
        placeholder="example.com"
      />
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={buttonClass('primary')}>
          {gymId ? 'Save changes' : 'Add gym'}
        </button>
        <Link to={gymId ? `/gyms/user/${gymId}` : '/gyms'} className={buttonClass('secondary')}>
          Cancel
        </Link>
      </div>
    </form>
  )
}

export function NewGymPage() {
  const [params] = useSearchParams()
  return (
    <Page title="Add a gym" back={{ to: '/gyms', label: 'Gyms' }}>
      <GymForm initialName={params.get('name') ?? ''} initialWebsite="" />
    </Page>
  )
}

export function EditGymPage() {
  const { id = '' } = useParams()
  // `null` once loaded and missing; `undefined` while loading.
  const gym = useLiveQuery(async () => (await repo.getUserGym(id)) ?? null, [id])

  if (gym === undefined) return <Page title="Edit gym" />
  if (gym === null) {
    return (
      <Page title="Gym not found" back={{ to: '/gyms', label: 'Gyms' }}>
        <p className="text-slate-600 dark:text-slate-400">
          This gym doesn’t exist, or only built-in gyms can’t be edited.
        </p>
      </Page>
    )
  }
  return (
    <Page title="Edit gym" back={{ to: `/gyms/user/${gym.id}`, label: gym.name }}>
      <GymForm gymId={gym.id} initialName={gym.name} initialWebsite={gym.website ?? ''} />
    </Page>
  )
}
