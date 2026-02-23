import type { Workspace } from '../types/terminal'
import { AGENT_HUES, STATUS_COLORS } from '../types/terminal'
import { useTerminalStore } from '../store/terminal-store'
import { TerminalPreview } from './TerminalPreview'

interface AgentCardProps {
  workspace: Workspace
  compact?: boolean
}

const STATUS_LABELS: Record<Workspace['status'], string> = {
  active: 'Active',
  thinking: 'Thinking',
  idle: 'Idle',
  error: 'Error',
}

export function AgentCard({ workspace, compact = false }: AgentCardProps) {
  const promoteAgent = useTerminalStore((s) => s.promoteAgent)
  const deleteWorkspace = useTerminalStore((s) => s.deleteWorkspace)
  const togglePin = useTerminalStore((s) => s.togglePin)
  const hue = AGENT_HUES[workspace.colorId]
  const statusColor = STATUS_COLORS[workspace.status]
  const statusClass = `status-border-${workspace.status}`
  return (
    <div
      onClick={() => promoteAgent(workspace.id)}
      className={`agent-card ${statusClass} cursor-pointer`}
      style={{
        '--agent-hue': hue,
        '--status-color': statusColor,
      } as React.CSSProperties}
    >
      {/* Live terminal preview */}
      {!compact && (
        <div className="agent-card-preview">
          <TerminalPreview terminalId={workspace.terminalIds[0]} />
        </div>
      )}

      {/* Info bar */}
      <div className={compact ? 'py-3 px-4' : 'px-4 py-4'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {/* Left accent dot */}
            <div
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{ backgroundColor: hue }}
            />
            <span className="agent-card-name">
              {workspace.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                togglePin(workspace.id)
              }}
              className={`agent-card-pin ${workspace.pinned ? 'agent-card-pin--active' : ''}`}
              title={workspace.pinned ? 'Unpin agent' : 'Pin agent'}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill={workspace.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.828 1.172a1 1 0 0 1 1.414 0l3.586 3.586a1 1 0 0 1 0 1.414l-3.12 3.12a1 1 0 0 1-.708.293H8.5l-1.793 1.793a1 1 0 0 1-.707.293H5l-1 1v1.5H2.5V12.5H4v-1l1-1v-1a1 1 0 0 1 .293-.707L7.086 7v-2.5a1 1 0 0 1 .293-.708l3.12-3.12Z" />
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteWorkspace(workspace.id)
              }}
              className="agent-card-close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 mt-1.5">
          <div
            className={`agent-card-status-dot ${workspace.status === 'thinking' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: statusColor }}
          />
          <span className="agent-card-status-label">
            {STATUS_LABELS[workspace.status]}
          </span>
          <span className="agent-card-meta">
            {workspace.terminalIds.length} {workspace.terminalIds.length === 1 ? 'pane' : 'panes'}
          </span>
        </div>
      </div>
    </div>
  )
}
