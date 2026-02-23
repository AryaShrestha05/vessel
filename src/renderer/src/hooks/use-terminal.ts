import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { getTerminalBuffer, deleteTerminalBuffer } from './use-terminal-buffer'
import { ingestTerminalOutput } from './use-terminal-meta'

// Track which PTY sessions have been created so we don't re-create on remount
const activePtys = new Set<string>()

// Map terminalId → cwd for terminals that should start in a specific directory
const terminalCwds = new Map<string, string>()

export function setTerminalCwd(terminalId: string, cwd: string): void {
  terminalCwds.set(terminalId, cwd)
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  terminalId: string
) {
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily: "'Geist Mono', 'SF Mono', Menlo, monospace",
      // Keep 10k lines of scrollback so users can scroll up through long output
      scrollback: 10000,
      // Required for WebGL renderer to draw on a transparent background
      allowTransparency: true,
      theme: {
        background: '#0a0a0f',
        foreground: '#e0e0e8',
        cursor: '#818cf8',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(129, 140, 248, 0.25)',
        selectionForeground: '#ffffff',
        black: '#3a3a4a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#818cf8',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#d0d0dc',
        brightBlack: '#5a5a6e',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde68a',
        brightBlue: '#a5b4fc',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f0f0f5',
      }
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    // WebLinks turns URLs in the terminal output into clickable links
    term.loadAddon(new WebLinksAddon())
    term.open(container)
    term.focus()

    const focus = () => term.focus()
    container.addEventListener('mousedown', focus, { capture: true })

    // WebGL renderer draws the terminal on a GPU-accelerated canvas instead
    // of the default DOM canvas, which is significantly faster for large outputs
    try {
      const webglAddon = new WebglAddon()
      // If the GPU context is lost (e.g. too many canvases), fall back gracefully
      webglAddon.onContextLoss(() => webglAddon.dispose())
      term.loadAddon(webglAddon)
    } catch {
      // WebGL unavailable — xterm falls back to its canvas renderer automatically
    }

    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    // Replay buffered output so the terminal shows its history on remount
    // (e.g. after floating/docking the pane). On first mount this is a no-op.
    const buffer = getTerminalBuffer(terminalId)
    for (const chunk of buffer) {
      term.write(chunk)
    }

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Only create the PTY if it hasn't been created yet
    if (!activePtys.has(terminalId)) {
      activePtys.add(terminalId)
      const cwd = terminalCwds.get(terminalId)
      terminalCwds.delete(terminalId) // consumed, no longer needed
      window.terminalAPI.create(terminalId, term.cols, term.rows, cwd)
    }

    const unsubData = window.terminalAPI.onData((id, data) => {
      if (id === terminalId) {
        ingestTerminalOutput(terminalId, data)
        term.write(data)
      }
    })

    const unsubExit = window.terminalAPI.onExit((id, exitCode) => {
      if (id === terminalId) {
        term.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
        activePtys.delete(terminalId)
      }
    })

    const onDataDisposable = term.onData((data) => {
      window.terminalAPI.write(terminalId, data)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (activePtys.has(terminalId)) {
        window.terminalAPI.resize(terminalId, term.cols, term.rows)
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      unsubData()
      unsubExit()
      onDataDisposable.dispose()
      container.removeEventListener('mousedown', focus, { capture: true } as AddEventListenerOptions)
      // Do NOT destroy the PTY here — the process should survive tab switches.
      // PTY destruction is handled by the store's deleteWorkspace/closePane actions.
      term.dispose()
    }
  }, [terminalId])

  return termRef
}

// Called externally to clean up tracking when a PTY is destroyed by the store
export function cleanupPtyTracking(terminalId: string): void {
  activePtys.delete(terminalId)
  deleteTerminalBuffer(terminalId)
}
