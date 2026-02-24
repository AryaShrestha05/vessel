import { useRef, useState } from 'react'
import { useTerminal } from '../hooks/use-terminal'
import { useTerminalStore } from '../store/terminal-store'
import type { SplitNode } from '../types/terminal'

interface TerminalPanelProps {
  terminalId: string
  workspaceId: string
}

type DockSide = 'left' | 'right' | 'top' | 'bottom'

function countLeaves(node: SplitNode): number {
  if (node.type === 'leaf') return 1
  return countLeaves(node.children[0]) + countLeaves(node.children[1])
}

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
  const floatPane = useTerminalStore((s) => s.floatPane)

  // Float is only available when there is more than one terminal in the split tree
  const canFloat = useTerminalStore((s) => {
    const ws = s.workspaces.find((w) => w.id === workspaceId)
    if (!ws) return false
    return countLeaves(ws.root) > 1
  })

  // Splitting is blocked at the 4-pane limit
  const canSplit = useTerminalStore((s) => {
    const ws = s.workspaces.find((w) => w.id === workspaceId)
    return ws ? ws.terminalIds.length < 4 : false
  })

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragEnter={(e) => {
        const isTerminal = e.dataTransfer.types.includes('application/x-vessel-terminal')
        const isWorkspace = e.dataTransfer.types.includes('application/x-vessel-workspace')
        if (!isTerminal && !isWorkspace) return
        e.stopPropagation()
        const side = getDockSide(e, e.currentTarget)
        setDockSide(side)
      }}
      onDragOver={(e) => {
        const isTerminal = e.dataTransfer.types.includes('application/x-vessel-terminal')
        const isWorkspace = e.dataTransfer.types.includes('application/x-vessel-workspace')
        if (!isTerminal && !isWorkspace) return
        e.preventDefault()
        e.stopPropagation() // prevent ActiveStage from seeing this and showing "Swap to stage"
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
        setDockSide(null)

        // ── Terminal → terminal dock (drag handle within the stage) ──────────
        const terminalRaw = e.dataTransfer.getData('application/x-vessel-terminal')
        if (terminalRaw) {
          e.preventDefault()
          e.stopPropagation()
          try {
            const data = JSON.parse(terminalRaw) as { workspaceId: string; terminalId: string }
            if (!data.workspaceId || !data.terminalId) return
            const side = getDockSide(e, e.currentTarget)
            if (!side) return
            dockTerminal(data.workspaceId, data.terminalId, workspaceId, terminalId, side)
          } catch { /* ignore */ }
          return
        }

        // ── Workspace card dock (drag from sidebar) ───────────────────────────
        // Pull the first terminal out of the source workspace and split it into this pane.
        const sourceWorkspaceId = e.dataTransfer.getData('application/x-vessel-workspace')
        if (sourceWorkspaceId) {
          e.preventDefault()
          e.stopPropagation()
          const side = getDockSide(e, e.currentTarget)
          if (!side) return
          const sourceWs = useTerminalStore.getState().workspaces.find((w) => w.id === sourceWorkspaceId)
          if (!sourceWs || sourceWs.terminalIds.length === 0) return
          dockTerminal(sourceWorkspaceId, sourceWs.terminalIds[0], workspaceId, terminalId, side)
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
            e.stopPropagation()
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData(
              'application/x-vessel-terminal',
              JSON.stringify({ workspaceId, terminalId })
            )
            e.dataTransfer.setData('text/plain', `${workspaceId}:${terminalId}`)
          }}
          title="Drag to move/split"
          className="terminal-toolbar-btn terminal-toolbar-btn-drag"
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
            <circle cx="3" cy="2.5" r="1" /><circle cx="7" cy="2.5" r="1" />
            <circle cx="3" cy="6"   r="1" /><circle cx="7" cy="6"   r="1" />
            <circle cx="3" cy="9.5" r="1" /><circle cx="7" cy="9.5" r="1" />
          </svg>
        </button>
        {/* Float: pop this pane out into a free-floating window */}
        <button
          onClick={(e) => { e.stopPropagation(); floatPane(workspaceId, terminalId) }}
          disabled={!canFloat}
          title={canFloat ? 'Float pane' : 'Cannot float — only one pane remains'}
          className="terminal-toolbar-btn"
          style={{ opacity: canFloat ? undefined : 0.3 }}
        >
          {/* Pop-out / float icon */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2.5H2.5v7h7V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 2.5h3v3M9.5 2.5L5.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="terminal-toolbar-sep" />
        <button
          onClick={() => splitPane(workspaceId, terminalId, 'horizontal')}
          disabled={!canSplit}
          title={canSplit ? 'Split right' : 'Max 4 panes reached'}
          className="terminal-toolbar-btn"
          style={{ opacity: canSplit ? undefined : 0.3 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          onClick={() => splitPane(workspaceId, terminalId, 'vertical')}
          disabled={!canSplit}
          title={canSplit ? 'Split down' : 'Max 4 panes reached'}
          className="terminal-toolbar-btn"
          style={{ opacity: canSplit ? undefined : 0.3 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <div className="terminal-toolbar-sep" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            closePane(workspaceId, terminalId)
          }}
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
