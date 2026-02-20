// Global buffer for terminal output — lets mini previews replay history on mount

const buffers = new Map<string, string[]>()
const MAX_BUFFER_BYTES = 100_000

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  window.terminalAPI.onData((id: string, data: string) => {
    if (!buffers.has(id)) {
      buffers.set(id, [])
    }
    const buf = buffers.get(id)!
    buf.push(data)

    // Trim oldest chunks if buffer exceeds limit
    let total = 0
    for (const chunk of buf) total += chunk.length
    while (total > MAX_BUFFER_BYTES && buf.length > 1) {
      total -= buf.shift()!.length
    }
  })
}

export function getTerminalBuffer(terminalId: string): string[] {
  init()
  return buffers.get(terminalId) ?? []
}

export function deleteTerminalBuffer(terminalId: string): void {
  buffers.delete(terminalId)
}

// Eagerly initialize so data is captured from the first terminal
init()
