'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

type ToastVariant = 'success' | 'error' | 'info'

type Toast = {
  id: number
  title: string
  description?: string
  variant?: ToastVariant
}

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_DELAY = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutsRef = useRef<Map<number, number>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))

    const timeoutId = timeoutsRef.current.get(id)
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      timeoutsRef.current.delete(id)
    }
  }, [])

  const pushToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const nextId = Date.now() + Math.random()
      setToasts((current) => [...current, { ...toast, id: nextId }])

      const timeoutId = window.setTimeout(() => {
        removeToast(nextId)
      }, AUTO_DISMISS_DELAY)
      timeoutsRef.current.set(nextId, timeoutId)
    },
    [removeToast]
  )

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutsRef.current.clear()
    }
  }, [])

  const value = useMemo(() => ({ pushToast, removeToast }), [pushToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
        <ul className="flex w-full max-w-sm flex-col gap-2">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.li
                key={toast.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="pointer-events-auto overflow-hidden rounded-lg border border-white/10 bg-base-900/90 p-4 shadow-lg backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white/90">{toast.title}</p>
                    {toast.description ? (
                      <p className="mt-1 text-xs text-white/70">{toast.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                {toast.variant ? (
                  <div
                    className="mt-3 h-1 rounded-full"
                    style={{
                      background:
                        toast.variant === 'success'
                          ? 'linear-gradient(90deg, rgba(34,197,94,0.9), rgba(59,130,246,0.9))'
                          : toast.variant === 'error'
                            ? 'linear-gradient(90deg, rgba(248,113,113,0.9), rgba(239,68,68,0.9))'
                            : 'linear-gradient(90deg, rgba(147,197,253,0.8), rgba(236,72,153,0.8))'
                    }}
                  />
                ) : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
