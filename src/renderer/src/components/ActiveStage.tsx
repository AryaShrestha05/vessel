import { SplitView } from './SplitView'
import type { Workspace } from '../types/terminal'
import { AGENT_HUES, STATUS_COLORS } from '../types/terminal'

interface ActiveStageProps {
  workspace: Workspace
  visible: boolean
}

const STATUS_LABELS: Record<Workspace['status'], string> = {
  active: 'Executing',
  thinking: 'Thinking...',
  idle: 'Idle',
  error: 'Error',
}

export function ActiveStage({ workspace, visible }: ActiveStageProps) {
  const hue = AGENT_HUES[workspace.colorId]
  const statusColor = STATUS_COLORS[workspace.status]
  const statusClass = `status-border-${workspace.status}`

  return (
    <div
      className={`active-stage ${statusClass} w-full h-full flex flex-col`}
      style={{
        '--agent-hue': hue,
        '--status-color': statusColor,
        display: visible ? 'flex' : 'none',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="active-stage-header">
        <div className="flex items-center gap-3">
          <div className="active-stage-dot" style={{ backgroundColor: hue }} />
          <span className="active-stage-name">
            {workspace.name}
          </span>
          <div className="active-stage-status-pill" style={{ '--pill-color': statusColor } as React.CSSProperties}>
            <div
              className={`w-[5px] h-[5px] rounded-full ${workspace.status === 'thinking' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: statusColor }}
            />
            <span>{STATUS_LABELS[workspace.status]}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="active-stage-meta">
            {workspace.terminalIds.length} {workspace.terminalIds.length === 1 ? 'pane' : 'panes'}
          </span>
          <kbd className="active-stage-kbd">
            &#8984;K
          </kbd>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 min-h-0">
        <div className="w-full h-full overflow-hidden" style={{ backgroundColor: 'var(--terminal-bg)' }}>
          <SplitView node={workspace.root} workspaceId={workspace.id} />
        </div>
      </div>
    </div>
  )
}
