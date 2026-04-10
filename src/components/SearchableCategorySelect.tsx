import { useEffect, useId, useMemo, useRef, useState } from 'react'

import type { Category } from '../lib/finance'

type SearchableCategorySelectProps = {
  label: string
  value: string
  options: Category[]
  placeholder?: string
  onChange: (categoryId: string) => void
}

function SearchableCategorySelect({
  label,
  value,
  options,
  placeholder = 'Type to search categories',
  onChange,
}: SearchableCategorySelectProps) {
  const inputId = useId()
  const listboxId = `${inputId}-listbox`
  const blurTimeoutRef = useRef<number | null>(null)
  const selectedOption = options.find((option) => option.id === value) ?? null
  const [query, setQuery] = useState(selectedOption?.name ?? '')
  const [open, setOpen] = useState(false)
  const inputValue = open ? query : (selectedOption?.name ?? query)

  useEffect(
    () => () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current)
      }
    },
    [],
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) =>
      option.name.toLowerCase().includes(normalizedQuery),
    )
  }, [options, query])

  const commitSelection = (categoryId: string) => {
    const nextOption = options.find((option) => option.id === categoryId)
    onChange(categoryId)
    setQuery(nextOption?.name ?? '')
    setOpen(false)
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className={`search-select ${open ? 'open' : ''}`}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => {
            setQuery(selectedOption?.name ?? '')
            setOpen(true)
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              setOpen(false)
              setQuery(selectedOption?.name ?? '')
            }, 120)
          }}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setOpen(true)

            const exactMatch = options.find(
              (option) => option.name.toLowerCase() === nextQuery.trim().toLowerCase(),
            )

            if (exactMatch) {
              onChange(exactMatch.id)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filteredOptions.length > 0) {
              event.preventDefault()
              commitSelection(filteredOptions[0].id)
            }

            if (event.key === 'Escape') {
              setOpen(false)
              setQuery(selectedOption?.name ?? '')
            }
          }}
        />

        {open ? (
          <div className="search-select-popover" role="presentation">
            <ul className="search-select-list" id={listboxId} role="listbox">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <li key={option.id} role="option" aria-selected={option.id === value}>
                    <button
                      type="button"
                      className={`search-select-option ${
                        option.id === value ? 'active' : ''
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        if (blurTimeoutRef.current !== null) {
                          window.clearTimeout(blurTimeoutRef.current)
                        }
                        commitSelection(option.id)
                      }}
                    >
                      <span>{option.name}</span>
                      {option.id === value ? <strong>Selected</strong> : null}
                    </button>
                  </li>
                ))
              ) : (
                <li className="search-select-empty">No matching categories</li>
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  )
}

export default SearchableCategorySelect
