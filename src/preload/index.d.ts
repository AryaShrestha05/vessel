// This tells TypeScript what `window.terminalAPI` looks like.
// Every method here matches what we exposed in preload/index.ts.
// Without this file, TypeScript would show red squiggles in our React code
// when we try to call window.terminalAPI.create(...) etc.

interface TerminalAPI {
  create(id: string, cols: number, rows: number, cwd?: string): Promise<{ pid: number }>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  destroy(id: string): void
  onData(callback: (id: string, data: string) => void): () => void
  onExit(callback: (id: string, exitCode: number) => void): () => void
}

declare global {
  interface Window {
    terminalAPI: TerminalAPI
  }
}

export {}
