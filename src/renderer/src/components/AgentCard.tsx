import type { Workspace } from '../types/terminal'
import { AGENT_HUES, STATUS_COLORS } from '../types/terminal'
import { useTerminalStore } from '../store/terminal-store'
import { useTerminalPreview } from '../hooks/use-terminal-preview'

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
  const hue = AGENT_HUES[workspace.colorId]
  const statusColor = STATUS_COLORS[workspace.status]
  const statusClass = `status-border-${workspace.status}`
  const preview = useTerminalPreview(workspace.terminalIds[0])

  return (
    <div
      onClick={() => promoteAgent(workspace.id)}
      draggable={workspace.terminalIds.length > 0}
      onDragStart={(e) => {
        e.stopPropagation()
        const terminalId = workspace.terminalIds[0]
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'application/x-vessel-terminal',
          JSON.stringify({ workspaceId: workspace.id, terminalId })
        )
        e.dataTransfer.setData('text/plain', `${workspace.id}:${terminalId}`)
      }}
      className={`agent-card ${statusClass} cursor-grab active:cursor-grabbing`}
      style={{
        '--agent-hue': hue,
        '--status-color': statusColor,
      } as React.CSSProperties}
    >
      {/* Terminal thumbnail preview - hero area */}
      {!compact && (
        <div className="agent-card-preview">
          {preview ? (
            <img
              src={preview}
              alt={`${workspace.name} terminal`}
              className="agent-card-preview-img"
              draggable={false}
            />
          ) : (
            <div className="agent-card-preview-placeholder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>
          )}
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
