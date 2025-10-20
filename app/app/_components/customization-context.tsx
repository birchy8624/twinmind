'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type ThemeSetting = 'light' | 'dark' | 'system'

type CustomizationSettings = {
  theme: ThemeSetting
  brandColor: string
  logoUrl: string | null
}

type CustomizationContextValue = {
  settings: CustomizationSettings
  resolvedTheme: Exclude<ThemeSetting, 'system'>
  setTheme: (theme: ThemeSetting) => void
  setBrandColor: (color: string) => void
  setLogoUrl: (value: string | null) => void
}

const STORAGE_KEY = 'twinmind:customization'

const DEFAULT_SETTINGS: CustomizationSettings = {
  theme: 'dark',
  brandColor: '#a3ff12',
  logoUrl: null
}

type RgbTuple = {
  r: number
  g: number
  b: number
}

type Palette = {
  100: RgbTuple
  300: RgbTuple
  500: RgbTuple
  600: RgbTuple
  700: RgbTuple
  foreground: RgbTuple
}

const CustomizationContext = createContext<CustomizationContextValue | undefined>(undefined)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const isHexColor = (value: string): boolean => /^#?[0-9a-fA-F]{6}$/.test(value.trim())

const normalizeHex = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return DEFAULT_SETTINGS.brandColor
  }
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return prefixed.toLowerCase()
}

const hexToRgb = (value: string): RgbTuple | null => {
  if (!isHexColor(value)) {
    return null
  }
  const normalized = normalizeHex(value).replace('#', '')
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

const rgbToCss = ({ r, g, b }: RgbTuple) => `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`

const rgbToHsl = ({ r, g, b }: RgbTuple): { h: number; s: number; l: number } => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))

    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6
        break
      case gn:
        h = (bn - rn) / delta + 2
        break
      case bn:
        h = (rn - gn) / delta + 4
        break
    }
  }

  h = Math.round(h * 60)
  if (h < 0) {
    h += 360
  }

  return { h, s, l }
}

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }): RgbTuple => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let rp = 0
  let gp = 0
  let bp = 0

  if (h >= 0 && h < 60) {
    rp = c
    gp = x
  } else if (h >= 60 && h < 120) {
    rp = x
    gp = c
  } else if (h >= 120 && h < 180) {
    gp = c
    bp = x
  } else if (h >= 180 && h < 240) {
    gp = x
    bp = c
  } else if (h >= 240 && h < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255
  }
}

const adjustLightness = (color: RgbTuple, delta: number): RgbTuple => {
  const hsl = rgbToHsl(color)
  const adjusted = {
    h: hsl.h,
    s: hsl.s,
    l: clamp(hsl.l + delta, 0, 1)
  }
  return hslToRgb(adjusted)
}

const luminance = ({ r, g, b }: RgbTuple) => {
  const normalize = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }

  const rn = normalize(r)
  const gn = normalize(g)
  const bn = normalize(b)

  return 0.2126 * rn + 0.7152 * gn + 0.0722 * bn
}

const getPalette = (value: string): Palette => {
  const base = hexToRgb(value) ?? hexToRgb(DEFAULT_SETTINGS.brandColor) ?? { r: 163, g: 255, b: 18 }
  const palette: Palette = {
    100: adjustLightness(base, 0.35),
    300: adjustLightness(base, 0.18),
    500: base,
    600: adjustLightness(base, -0.08),
    700: adjustLightness(base, -0.18),
    foreground: luminance(base) > 0.6 ? { r: 21, g: 30, b: 15 } : { r: 255, g: 255, b: 255 }
  }

  return palette
}

const parseStoredSettings = (value: string | null): CustomizationSettings => {
  if (!value) {
    return DEFAULT_SETTINGS
  }

  try {
    const parsed = JSON.parse(value) as Partial<CustomizationSettings>
    const theme = parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : DEFAULT_SETTINGS.theme
    const brandColor = parsed.brandColor && isHexColor(parsed.brandColor) ? normalizeHex(parsed.brandColor) : DEFAULT_SETTINGS.brandColor
    const logoUrl = typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null

    return { theme, brandColor, logoUrl }
  } catch (error) {
    console.warn('Failed to parse customization settings, falling back to defaults', error)
    return DEFAULT_SETTINGS
  }
}

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CustomizationSettings>(DEFAULT_SETTINGS)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => 'dark')
  const isMountedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const stored = parseStoredSettings(window.localStorage.getItem(STORAGE_KEY))
    setSettings(stored)
    isMountedRef.current = true
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    handler(media)

    const listener = (event: MediaQueryListEvent) => handler(event)
    media.addEventListener('change', listener)

    return () => {
      media.removeEventListener('change', listener)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !isMountedRef.current) {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const resolvedTheme: 'light' | 'dark' = settings.theme === 'system' ? systemTheme : settings.theme

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.classList.toggle('light', resolvedTheme === 'light')
  }, [resolvedTheme])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const palette = getPalette(settings.brandColor)
    const root = document.documentElement

    root.style.setProperty('--brand-color-100', rgbToCss(palette[100]))
    root.style.setProperty('--brand-color-300', rgbToCss(palette[300]))
    root.style.setProperty('--brand-color-500', rgbToCss(palette[500]))
    root.style.setProperty('--brand-color-600', rgbToCss(palette[600]))
    root.style.setProperty('--brand-color-700', rgbToCss(palette[700]))
    root.style.setProperty('--brand-color-rgb', rgbToCss(palette[500]))
    root.style.setProperty('--brand-color-foreground', rgbToCss(palette.foreground))
  }, [settings.brandColor])

  const setTheme = useCallback((theme: ThemeSetting) => {
    setSettings((previous) => ({ ...previous, theme }))
  }, [])

  const setBrandColor = useCallback((color: string) => {
    const normalized = isHexColor(color) ? normalizeHex(color) : DEFAULT_SETTINGS.brandColor
    setSettings((previous) => ({ ...previous, brandColor: normalized }))
  }, [])

  const setLogoUrl = useCallback((value: string | null) => {
    setSettings((previous) => ({ ...previous, logoUrl: value }))
  }, [])

  const value = useMemo<CustomizationContextValue>(
    () => ({
      settings,
      resolvedTheme,
      setTheme,
      setBrandColor,
      setLogoUrl
    }),
    [setBrandColor, setLogoUrl, setTheme, settings, resolvedTheme]
  )

  return <CustomizationContext.Provider value={value}>{children}</CustomizationContext.Provider>
}

export const useCustomization = () => {
  const context = useContext(CustomizationContext)
  if (!context) {
    throw new Error('useCustomization must be used within a CustomizationProvider')
  }
  return context
}
