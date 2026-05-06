import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { Toast, ToastInput } from '../components/Toast'

interface ToastWithId extends ToastInput {
  id: string
}

interface ToastContextValue {
  show: (input: ToastInput) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastWithId[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { ...input, id }])
      const duration = input.durationMs ?? 7000
      if (duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id)
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }, duration)
        timersRef.current.set(id, timer)
      }
      return id
    },
    [],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
