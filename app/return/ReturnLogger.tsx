'use client'

import { useEffect } from 'react'

type ReturnLoggerProps = {
  status: 'success' | 'error'
  message: string
  details?: Record<string, unknown>
}

export function ReturnLogger({ status, message, details }: ReturnLoggerProps) {
  useEffect(() => {
    const logMessage = `[billing:return:${status}] ${message}`

    if (status === 'error') {
      console.error(logMessage, details ?? null)
    } else {
      console.log(logMessage, details ?? null)
    }
  }, [status, message, details])

  return null
}
