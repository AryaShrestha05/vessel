import { useRef, useState } from 'react'
import { useTerminal } from '../hooks/use-terminal'
import { useTerminalStore } from '../store/terminal-store'

interface TerminalPanelProps {
  terminalId: string
  workspaceId: string
}

export function TerminalPanel({ terminalId, workspaceId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(containerRef, terminalId)
  const [hovered, setHovered] = useState(false)
  const splitPane = useTerminalStore((s) => s.splitPane)
  const closePane = useTerminalStore((s) => s.closePane)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full h-full relative"
      style={{ backgroundColor: 'var(--terminal-bg)' }}
    >
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {/* Floating toolbar */}
      <div
        className="terminal-toolbar"
        style={{
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(-4px)',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        <button
          onClick={() => splitPane(workspaceId, terminalId, 'horizontal')}
          title="Split right"
          className="terminal-toolbar-btn"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          onClick={() => splitPane(workspaceId, terminalId, 'vertical')}
          title="Split down"
          className="terminal-toolbar-btn"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <div className="terminal-toolbar-sep" />
        <button
          onClick={() => closePane(workspaceId, terminalId)}
          title="Close pane"
          className="terminal-toolbar-btn terminal-toolbar-btn-danger"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
