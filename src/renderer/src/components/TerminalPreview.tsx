import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { getTerminalBuffer } from '../hooks/use-terminal-buffer'

interface TerminalPreviewProps {
  terminalId: string
}

export function TerminalPreview({ terminalId }: TerminalPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontSize: 7,
      lineHeight: 1.2,
      fontFamily: "'Geist Mono', 'SF Mono', Menlo, monospace",
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      disableStdin: true,
      scrollback: 150,
      theme: {
        background: '#0a0a0f',
        foreground: '#e0e0e8',
        cursor: 'transparent',
        cursorAccent: 'transparent',
        selectionBackground: 'transparent',
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
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    // Replay buffered history so the preview isn't blank
    const buffer = getTerminalBuffer(terminalId)
    for (const chunk of buffer) {
      term.write(chunk)
    }

    // Subscribe to live data from the PTY
    const unsub = window.terminalAPI.onData((id, data) => {
      if (id === terminalId) {
        term.write(data)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(container)

    return () => {
      unsub()
      resizeObserver.disconnect()
      term.dispose()
    }
  }, [terminalId])

  return <div ref={containerRef} className="terminal-preview-live" />
}
