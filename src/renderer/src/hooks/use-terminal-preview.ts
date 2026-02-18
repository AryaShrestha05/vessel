import { useEffect, useState } from 'react'

// Global store: terminalId -> data URL of the latest canvas snapshot
const previews = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()

export function setTerminalPreview(terminalId: string, dataUrl: string): void {
  previews.set(terminalId, dataUrl)
  listeners.get(terminalId)?.forEach((fn) => fn())
}

export function deleteTerminalPreview(terminalId: string): void {
  previews.delete(terminalId)
  listeners.delete(terminalId)
}

export function useTerminalPreview(terminalId: string | undefined): string | null {
  const [preview, setPreview] = useState<string | null>(
    terminalId ? previews.get(terminalId) ?? null : null
  )

  useEffect(() => {
    if (!terminalId) return

    // Sync in case it changed before subscribe
    setPreview(previews.get(terminalId) ?? null)

    const update = () => setPreview(previews.get(terminalId) ?? null)

    if (!listeners.has(terminalId)) {
      listeners.set(terminalId, new Set())
    }
    listeners.get(terminalId)!.add(update)

    return () => {
      listeners.get(terminalId)?.delete(update)
    }
  }, [terminalId])

  return preview
}
