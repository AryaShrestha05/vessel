import { useRef, useState } from 'react'
import { useTerminal } from '../hooks/use-terminal'
import { useTerminalStore } from '../store/terminal-store'

interface TerminalPanelProps {
  terminalId: string
  workspaceId: string
}

type DockSide = 'left' | 'right' | 'top' | 'bottom'

function getDockSide(e: React.DragEvent, el: HTMLElement): DockSide | null {
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / Math.max(1, r.width)
  const y = (e.clientY - r.top) / Math.max(1, r.height)
  const edge = 0.26

  if (x <= edge) return 'left'
  if (x >= 1 - edge) return 'right'
  if (y <= edge) return 'top'
  if (y >= 1 - edge) return 'bottom'
  return null
}

export function TerminalPanel({ terminalId, workspaceId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(containerRef, terminalId)
  const [hovered, setHovered] = useState(false)
  const [dockSide, setDockSide] = useState<DockSide | null>(null)
  const splitPane = useTerminalStore((s) => s.splitPane)
  const closePane = useTerminalStore((s) => s.closePane)
  const dockTerminal = useTerminalStore((s) => s.dockTerminal)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragEnter={(e) => {
        const payload = e.dataTransfer.types.includes('application/x-vessel-terminal')
        if (!payload) return
        const side = getDockSide(e, e.currentTarget)
        setDockSide(side)
      }}
      onDragOver={(e) => {
        const payload = e.dataTransfer.types.includes('application/x-vessel-terminal')
        if (!payload) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const side = getDockSide(e, e.currentTarget)
        setDockSide(side)
      }}
      onDragLeave={(e) => {
        const next = e.relatedTarget as Node | null
        if (next && e.currentTarget.contains(next)) return
        setDockSide(null)
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData('application/x-vessel-terminal')
        setDockSide(null)
        if (!raw) return
        e.preventDefault()
        try {
          const data = JSON.parse(raw) as { workspaceId: string; terminalId: string }
          if (!data.workspaceId || !data.terminalId) return
          const side = getDockSide(e, e.currentTarget)
          if (!side) return
          dockTerminal(data.workspaceId, data.terminalId, workspaceId, terminalId, side)
        } catch {
          // ignore
        }
      }}
      className={`terminal-panel w-full h-full relative ${dockSide ? 'terminal-panel--docking' : ''}`}
      style={{ backgroundColor: 'var(--terminal-bg)' }}
    >
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {dockSide && (
        <div className={`terminal-drop-hint terminal-drop-hint--${dockSide}`} />
      )}

      {/* Floating toolbar */}
      <div
        className="terminal-toolbar"
        style={{
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(-4px)',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        {/* Drag handle — sets the dataTransfer payload so drop targets can receive it */}
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData(
              'application/x-vessel-terminal',
              JSON.stringify({ workspaceId, terminalId })
            )
          }}
          title="Drag to another workspace"
          className="terminal-toolbar-btn"
          style={{ cursor: 'grab' }}
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
            <circle cx="3" cy="2.5" r="1" /><circle cx="7" cy="2.5" r="1" />
            <circle cx="3" cy="6"   r="1" /><circle cx="7" cy="6"   r="1" />
            <circle cx="3" cy="9.5" r="1" /><circle cx="7" cy="9.5" r="1" />
          </svg>
        </button>
        <div className="terminal-toolbar-sep" />
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
