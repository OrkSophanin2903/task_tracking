export interface Toast {
  id: number
  type: 'error' | 'success' | 'info'
  message: string
}

/**
 * Tiny global toast store (SSR-safe via useState). Components call `push` to
 * surface a non-blocking notification; <ToastHost> renders them.
 */
export function useToasts() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(
    message: string,
    type: Toast['type'] = 'error',
    timeoutMs = 5000,
  ): void {
    const id = Date.now() + Math.random()
    toasts.value = [...toasts.value, { id, type, message }]
    if (timeoutMs > 0) {
      setTimeout(() => dismiss(id), timeoutMs)
    }
  }

  return { toasts, push, dismiss }
}
