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

// ─── Terminal instance cache ──────────────────────────────────────────────────
// xterm + WebGL instances are expensive to create and destroy.
// When a TerminalPanel unmounts (e.g. because the split tree changed from a
// single leaf to an Allotment branch), we DETACH the xterm DOM node from its
// host div but KEEP the Terminal instance alive in this cache.
// On the next mount for the same terminalId we re-attach the DOM node to the
// new host div — the WebGL context, scroll history, and canvas all survive.
interface TerminalEntry {
  term: Terminal
  fitAddon: FitAddon
  xtermEl: HTMLElement  // the .xterm root element xterm creates inside the host
}
const terminalCache = new Map<string, TerminalEntry>()

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
    const hostDiv = containerRef.current
    if (!hostDiv) return

    let term: Terminal
    let fitAddon: FitAddon

    const cached = terminalCache.get(terminalId)

    if (cached) {
      // ── Re-attach: move the existing xterm DOM node into the new host div ──
      // The WebGL canvas, scroll history, and PTY connection all survive.
      term = cached.term
      fitAddon = cached.fitAddon
      hostDiv.appendChild(cached.xtermEl)
    } else {
      // ── First mount: create and cache a new terminal instance ────────────
      term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 13,
        lineHeight: 1.35,
        fontFamily: "'Geist Mono', 'SF Mono', Menlo, monospace",
        scrollback: 10000,
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

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(hostDiv)

      try {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => webglAddon.dispose())
        term.loadAddon(webglAddon)
      } catch {
        // WebGL unavailable — xterm falls back to canvas renderer automatically
      }

      // Replay buffered output on remount so history is preserved.
      // On a true first mount this is a no-op.
      const buffer = getTerminalBuffer(terminalId)
      for (const chunk of buffer) {
        term.write(chunk)
      }

      // Cache the .xterm root element so we can move it on future remounts
      const xtermEl = hostDiv.querySelector('.xterm') as HTMLElement
      terminalCache.set(terminalId, { term, fitAddon, xtermEl })

      // Create the PTY process (only once per terminal)
      if (!activePtys.has(terminalId)) {
        activePtys.add(terminalId)
        const cwd = terminalCwds.get(terminalId)
        terminalCwds.delete(terminalId)
        window.terminalAPI.create(terminalId, term.cols, term.rows, cwd)
      }
    }

    termRef.current = term
    fitAddonRef.current = fitAddon

    term.focus()
    const focus = () => term.focus()
    hostDiv.addEventListener('mousedown', focus, { capture: true })

    // Fit with retry: Allotment measures panes asynchronously, so the host div
    // may have 0×0 dimensions on the first frame. Retry until it has real size.
    let fitCancelled = false
    const tryFit = (attempt = 0) => {
      if (fitCancelled || !hostDiv.isConnected) return
      if (hostDiv.clientWidth > 0 && hostDiv.clientHeight > 0) {
        fitAddon.fit()
        if (activePtys.has(terminalId)) {
          window.terminalAPI.resize(terminalId, term.cols, term.rows)
        }
      } else if (attempt < 20) {
        setTimeout(() => tryFit(attempt + 1), 16)
      }
    }
    setTimeout(() => tryFit())

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
    resizeObserver.observe(hostDiv)

    return () => {
      fitCancelled = true
      resizeObserver.disconnect()
      unsubData()
      unsubExit()
      onDataDisposable.dispose()
      hostDiv.removeEventListener('mousedown', focus, { capture: true } as AddEventListenerOptions)

      // DETACH the xterm DOM node from this host div — do NOT dispose the Terminal.
      // The instance stays alive in terminalCache so the next mount can re-attach it
      // without destroying the WebGL context or losing scroll history.
      const entry = terminalCache.get(terminalId)
      if (entry && entry.xtermEl.parentNode === hostDiv) {
        hostDiv.removeChild(entry.xtermEl)
      }
    }
  }, [terminalId])

  return termRef
}

// Called by the store when a PTY is intentionally destroyed (closePane / deleteWorkspace).
// This is the ONE place where we actually dispose the Terminal instance.
export function cleanupPtyTracking(terminalId: string): void {
  activePtys.delete(terminalId)
  deleteTerminalBuffer(terminalId)
  const entry = terminalCache.get(terminalId)
  if (entry) {
    entry.term.dispose()
    terminalCache.delete(terminalId)
  }
}
