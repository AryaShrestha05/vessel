import { useEffect, useState } from 'react'

export interface TerminalMeta {
  cwdName?: string
  branch?: string
  updatedAt: number
}

const metaById = new Map<string, TerminalMeta>()
const listeners = new Map<string, Set<() => void>>()

function emit(id: string) {
  listeners.get(id)?.forEach((fn) => fn())
}

const RE_GIT_BRANCH = /\bgit:\(([^)]+)\)/
const RE_ARROW_REPO_BRANCH = /➜\s+([^\s]+)\s+git:\(([^)]+)\)/

export function ingestTerminalOutput(terminalId: string, chunk: string): void {
  const prev = metaById.get(terminalId)
  const next: TerminalMeta = prev ? { ...prev } : { updatedAt: Date.now() }

  let changed = false

  const arrowMatch = chunk.match(RE_ARROW_REPO_BRANCH)
  if (arrowMatch) {
    const cwdName = arrowMatch[1]
    const branch = arrowMatch[2]
    if (cwdName && cwdName !== next.cwdName) { next.cwdName = cwdName; changed = true }
    if (branch && branch !== next.branch) { next.branch = branch; changed = true }
  } else {
    const branchMatch = chunk.match(RE_GIT_BRANCH)
    if (branchMatch?.[1] && branchMatch[1] !== next.branch) {
      next.branch = branchMatch[1]
      changed = true
    }
  }

  if (!changed) return
  next.updatedAt = Date.now()
  metaById.set(terminalId, next)
  emit(terminalId)
}

export function useTerminalMeta(terminalId: string | undefined): TerminalMeta | null {
  const [meta, setMeta] = useState<TerminalMeta | null>(() => (terminalId ? metaById.get(terminalId) ?? null : null))

  useEffect(() => {
    if (!terminalId) return
    setMeta(metaById.get(terminalId) ?? null)

    const update = () => setMeta(metaById.get(terminalId) ?? null)
    if (!listeners.has(terminalId)) listeners.set(terminalId, new Set())
    listeners.get(terminalId)!.add(update)

    return () => {
      listeners.get(terminalId)?.delete(update)
    }
  }, [terminalId])

  return meta
}

