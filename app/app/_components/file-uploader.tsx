'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from './toast-context'

export type UploadedFile = {
  name: string
  path: string
}

type FileUploaderProps = {
  onUploadComplete?: (file: UploadedFile) => void
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const { pushToast } = useToast()
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  const reset = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
    }
    progressInterval.current = null
    setProgress(0)
    setCurrentFile(null)
  }, [])

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || !fileList[0]) return
      const file = fileList[0]
      setCurrentFile(file)
      setProgress(0)

      progressInterval.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            if (progressInterval.current) {
              clearInterval(progressInterval.current)
              progressInterval.current = null
            }
            const storedPath = `/uploads/${Date.now()}-${file.name}`
            onUploadComplete?.({ name: file.name, path: storedPath })
            pushToast({
              title: 'Upload complete',
              description: `${file.name} is now available in the project repository.`,
              variant: 'success'
            })
            return 100
          }
          const nextValue = Math.min(prev + 10, 100)
          if (nextValue >= 100) {
            setTimeout(() => {
              reset()
            }, 900)
          }
          return nextValue
        })
      }, 180)
    },
    [onUploadComplete, pushToast, reset]
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault()
      setIsDragging(false)
      handleFiles(event.dataTransfer.files)
    },
    [handleFiles]
  )

  const dragLabelClasses = useMemo(
    () =>
      `relative flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition-all ${
        isDragging
          ? 'border-limeglow-500/80 bg-limeglow-500/10 text-limeglow-100 shadow-[0_0_25px_rgba(163,255,18,0.35)]'
          : 'border-white/10 bg-base-900/60 text-white/70 hover:border-white/20 hover:bg-base-900/70'
      }`,
    [isDragging]
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white/80">Upload deliverables</h3>
        <p className="mt-1 text-xs text-white/60">Drag your signed decks, SOWs, and exports here to keep the team in sync.</p>
      </div>
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={dragLabelClasses}
      >
        <input
          type="file"
          onChange={(event) => handleFiles(event.target.files)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70">
          Drop file or browse
        </div>
        <p className="text-xs text-white/50">We sync files to the secure studio drive automatically.</p>
      </label>
      <AnimatePresence>
        {currentFile ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="rounded-xl border border-white/10 bg-base-900/70 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white/80">{currentFile.name}</p>
                <p className="text-xs text-white/50">{(currentFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-md px-3 py-1 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-limeglow-500 via-limeglow-600 to-limeglow-700"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
