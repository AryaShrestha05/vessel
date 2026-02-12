// This file tells TypeScript what `window.terminalAPI` looks like.
// Without this, TypeScript would complain that `terminalAPI` doesn't exist on `window`.
// We'll expand this interface as we add more IPC methods.

interface TerminalAPI {
  // Terminal IPC methods will be added here in Phase 2
}

declare global {
  interface Window {
    terminalAPI: TerminalAPI
  }
}

export {}
