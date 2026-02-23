import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { setTerminalPreview, deleteTerminalPreview } from './use-terminal-preview'

// Track which PTY sessions have been created so we don't re-create on remount
const activePtys = new Set<string>()

function captureTerminalCanvas(container: HTMLElement, terminalId: string): void {
  // xterm.js renders into canvas elements inside .xterm-screen
  const canvases = container.querySelectorAll<HTMLCanvasElement>('.xterm-screen canvas')
  if (canvases.length === 0) return

  // Find the largest canvas (the main text layer)
  let mainCanvas: HTMLCanvasElement | null = null
  let maxArea = 0
  canvases.forEach((c) => {
    const area = c.width * c.height
    if (area > maxArea) {
      maxArea = area
      mainCanvas = c
    }
  })

  if (!mainCanvas || maxArea === 0) return

  try {
    // Draw to a small thumbnail canvas for efficiency
    const thumb = document.createElement('canvas')
    const scale = 0.5
    thumb.width = (mainCanvas as HTMLCanvasElement).width * scale
    thumb.height = (mainCanvas as HTMLCanvasElement).height * scale
    const ctx = thumb.getContext('2d')
    if (!ctx) return
    ctx.drawImage(mainCanvas, 0, 0, thumb.width, thumb.height)
    const dataUrl = thumb.toDataURL('image/png', 0.6)
    setTerminalPreview(terminalId, dataUrl)
  } catch {
    // Canvas may be tainted or empty, ignore
  }
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

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Only create the PTY if it hasn't been created yet
    if (!activePtys.has(terminalId)) {
      activePtys.add(terminalId)
      window.terminalAPI.create(terminalId, term.cols, term.rows)
    }

    const unsubData = window.terminalAPI.onData((id, data) => {
      if (id === terminalId) term.write(data)
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

    // Capture terminal preview snapshots periodically
    // Initial capture after a short delay to let content render
    const initialCapture = setTimeout(() => {
      captureTerminalCanvas(container, terminalId)
    }, 500)

    const captureInterval = setInterval(() => {
      // Only capture if the container is actually visible (not display:none)
      if (container.offsetParent !== null) {
        captureTerminalCanvas(container, terminalId)
      }
    }, 1500)

    return () => {
      clearTimeout(initialCapture)
      clearInterval(captureInterval)
      resizeObserver.disconnect()
      unsubData()
      unsubExit()
      onDataDisposable.dispose()
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
  deleteTerminalPreview(terminalId)
}
