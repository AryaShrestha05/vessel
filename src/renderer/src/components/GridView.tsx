import { SplitView } from './SplitView'
import { FloatingTerminal } from './FloatingTerminal'
import type { Workspace } from '../types/terminal'
import { AGENT_HUES, STATUS_COLORS } from '../types/terminal'
import { useTerminalStore } from '../store/terminal-store'
import { useUIStore } from '../store/ui-store'

const STATUS_LABELS: Record<Workspace['status'], string> = {
  active: 'Executing',
  thinking: 'Thinking...',
  idle: 'Idle',
  error: 'Error',
}

function gridColumns(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

function gridRows(count: number, cols: number): number {
  return Math.ceil(count / cols)
}

interface GridCellProps {
  workspace: Workspace
}

function GridCell({ workspace }: GridCellProps) {
  const hue = AGENT_HUES[workspace.colorId]
  const statusColor = STATUS_COLORS[workspace.status]
  const statusClass = `status-border-${workspace.status}`
  const promoteAgent = useTerminalStore((s) => s.promoteAgent)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const deleteWorkspace = useTerminalStore((s) => s.deleteWorkspace)

  function handleDoubleClick() {
    promoteAgent(workspace.id)
    setViewMode('focus')
  }

  return (
    <div
      className={`grid-cell ${statusClass}`}
      style={{
        '--agent-hue': hue,
        '--status-color': statusColor,
      } as React.CSSProperties}
    >
      {/* Compact header */}
      <div className="grid-cell-header" onDoubleClick={handleDoubleClick}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid-cell-dot" style={{ backgroundColor: hue }} />
          <span className="grid-cell-name">{workspace.name}</span>
          <div className="grid-cell-status-pill" style={{ '--pill-color': statusColor } as React.CSSProperties}>
            <div
              className={`w-[5px] h-[5px] rounded-full ${workspace.status === 'thinking' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: statusColor }}
            />
            <span>{STATUS_LABELS[workspace.status]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid-cell-close"
            onClick={() => deleteWorkspace(workspace.id)}
            title="Close workspace"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal area — fully interactive */}
      <div className="grid-cell-terminal">
        <div className="w-full h-full overflow-hidden" style={{ backgroundColor: 'var(--terminal-bg)' }}>
          <SplitView node={workspace.root} workspaceId={workspace.id} />
        </div>

        {workspace.floatedPanes.map((pane) => (
          <FloatingTerminal
            key={pane.terminalId}
            terminalId={pane.terminalId}
            workspaceId={workspace.id}
            pane={pane}
            workspaceName={workspace.name}
          />
        ))}
      </div>

      {/* Hover overlay hint */}
      <div className="grid-cell-focus-hint" onDoubleClick={handleDoubleClick}>
        <span>Double-click to focus</span>
      </div>
    </div>
  )
}

interface GridViewProps {
  workspaces: Workspace[]
}

export function GridView({ workspaces }: GridViewProps) {
  const cols = gridColumns(workspaces.length)
  const rows = gridRows(workspaces.length, cols)

  return (
    <div
      className="grid-view"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {workspaces.map((workspace) => (
        <GridCell key={workspace.id} workspace={workspace} />
      ))}
    </div>
  )
}
