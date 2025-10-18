"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Option = {
  value: string
  label: string
}

type MultiSelectDropdownProps = {
  /**
   * Small uppercase label rendered to the left of the trigger.
   */
  label: string
  /**
   * Currently selected values.
   */
  values: string[]
  /**
   * Options available within the dropdown menu.
   */
  options: Array<Option | string>
  /**
   * Called when the user selects or deselects an option.
   */
  onChange: (values: string[]) => void
  /**
   * Trigger label used when no values are selected.
   */
  placeholder?: string
  className?: string
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ")
}

function normalizeOptions(options: MultiSelectDropdownProps["options"]): Option[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  )
}

export function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
  placeholder = "All",
  className
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options])
  const orderedSelectedValues = useMemo(() => {
    const selection = new Set(values)
    return normalizedOptions
      .filter((option) => selection.has(option.value))
      .map((option) => option.value)
  }, [values, normalizedOptions])

  const selectedLabels = useMemo(() => {
    const labels = new Map(normalizedOptions.map((option) => [option.value, option.label]))
    return orderedSelectedValues.map((value) => labels.get(value) ?? value)
  }, [normalizedOptions, orderedSelectedValues])

  const selectedSummary = useMemo(() => {
    if (orderedSelectedValues.length === 0) {
      return placeholder
    }
    if (orderedSelectedValues.length === 1) {
      return selectedLabels[0]
    }
    if (orderedSelectedValues.length === 2) {
      return selectedLabels.join(", ")
    }
    return `${orderedSelectedValues.length} selected`
  }, [orderedSelectedValues.length, placeholder, selectedLabels])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (event.target instanceof Node && containerRef.current.contains(event.target)) {
        return
      }
      setIsOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const firstOption = listRef.current?.querySelector<HTMLButtonElement>("button")
    if (firstOption) {
      requestAnimationFrame(() => firstOption.focus())
    }
  }, [isOpen])

  const toggleValue = (value: string) => {
    const isSelected = orderedSelectedValues.includes(value)
    const nextSelection = isSelected
      ? orderedSelectedValues.filter((selectedValue) => selectedValue !== value)
      : [...orderedSelectedValues, value]
    onChange(nextSelection)
  }

  return (
    <div className={classNames("relative w-full", className)} ref={containerRef}>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-base-900/60 px-4 py-2 text-sm text-white/70 focus-within:border-white/30 focus-within:text-white/80">
        <span className="text-xs uppercase tracking-wide text-white/40">{label}</span>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((previous) => !previous)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              setIsOpen(true)
            }
          }}
          className="flex w-full items-center justify-between gap-3 text-left text-sm text-white/80 outline-none"
        >
          <span className="truncate">{selectedSummary}</span>
          <svg
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={classNames(
              "h-3 w-3 shrink-0 text-white/50 transition-transform",
              isOpen ? "rotate-180" : "rotate-0"
            )}
          >
            <path
              d="M2.25 4.5 6 8.25 9.75 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {isOpen ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-full min-w-[12rem] overflow-hidden rounded-2xl border border-white/10 bg-base-900/95 p-1 text-sm text-white/80 shadow-xl shadow-black/20 backdrop-blur">
          <ul
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-60 overflow-y-auto py-1"
          >
            {normalizedOptions.map((option) => {
              const isSelected = orderedSelectedValues.includes(option.value)
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={classNames(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition",
                      isSelected
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 focus-visible:bg-white/10 focus-visible:text-white"
                    )}
                    onClick={() => toggleValue(option.value)}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        className="h-3.5 w-3.5 text-limeglow-400"
                      >
                        <path d="m3.5 8 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          {orderedSelectedValues.length > 0 ? (
            <div className="border-t border-white/10 px-3 py-2 text-right">
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:text-white"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
