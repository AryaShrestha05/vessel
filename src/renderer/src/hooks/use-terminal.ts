import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

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
    term.open(container)

    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    termRef.current = term
    fitAddonRef.current = fitAddon

    window.terminalAPI.create(terminalId, term.cols, term.rows)

    const unsubData = window.terminalAPI.onData((id, data) => {
      if (id === terminalId) term.write(data)
    })

    const unsubExit = window.terminalAPI.onExit((id, exitCode) => {
      if (id === terminalId) {
        term.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })

    const onDataDisposable = term.onData((data) => {
      window.terminalAPI.write(terminalId, data)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      window.terminalAPI.resize(terminalId, term.cols, term.rows)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      unsubData()
      unsubExit()
      onDataDisposable.dispose()
      window.terminalAPI.destroy(terminalId)
      term.dispose()
    }
  }, [terminalId])

  return termRef
}
