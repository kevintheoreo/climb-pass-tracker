import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { resolveGymInput, searchGyms, type GymEntry } from '../../domain/gyms'
import { cleanGymName } from '../../domain/gyms'

const MAX_SUGGESTIONS = 6

interface Option {
  key: string
  label: string
  /** The text the cell takes when this option is chosen. */
  text: string
}

/**
 * The Gym cell (D24, FR-53): a text box with a dropdown of matching gyms, built-in and the user's
 * own. Typing a name that matches none offers "Add “text” as a new gym"; the gym itself is only
 * created when the row saves. Works by keyboard (arrows, Enter, Escape) and every option is 44px
 * tall.
 */
export function GymCombobox({
  value,
  onChange,
  gyms,
  error,
  inputRef,
}: {
  value: string
  onChange: (text: string) => void
  gyms: GymEntry[]
  error?: string | undefined
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const id = useId()
  const listId = `${id}-list`
  const errorId = `${id}-error`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const options = useMemo<Option[]>(() => {
    const matches = searchGyms(gyms, value)
      .slice(0, MAX_SUGGESTIONS)
      .map((g): Option => ({ key: `${g.ref.kind}-${g.ref.id}`, label: g.name, text: g.name }))
    const choice = resolveGymInput(value, gyms)
    if (choice.kind === 'new') {
      matches.push({
        key: 'new',
        label: `Add “${choice.name}” as a new gym`,
        text: choice.name,
      })
    }
    return matches
  }, [gyms, value])

  const shown = open && options.length > 0

  const pick = (option: Option) => {
    onChange(option.text)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1))
    } else if (e.key === 'Escape' && shown) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setActive(-1)
    } else if (e.key === 'Enter' && shown && active >= 0) {
      // Choosing from the list is not "finish the row".
      e.preventDefault()
      e.stopPropagation()
      const option = options[active]
      if (option) pick(option)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-label="Gym"
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        placeholder="Gym name"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
          // Tidy the spaces once the person has finished typing.
          if (value !== cleanGymName(value) && cleanGymName(value) !== '')
            onChange(cleanGymName(value))
        }}
        onKeyDown={onKeyDown}
        className="block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching gyms"
        hidden={!shown}
        className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
      >
        {options.map((option, i) => (
          <li
            key={option.key}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            // mousedown (not click) so the text box keeps focus and the row doesn't think it was left.
            onMouseDown={(e) => {
              e.preventDefault()
              pick(option)
            }}
            className={`flex min-h-11 cursor-pointer items-center px-3 py-2 text-base ${
              i === active ? 'bg-teal-100 dark:bg-teal-900/50' : ''
            } ${option.key === 'new' ? 'font-medium text-teal-800 dark:text-teal-300' : ''}`}
          >
            {option.label}
          </li>
        ))}
      </ul>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
