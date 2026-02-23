import { useState } from 'react'
import { SplitView } from './SplitView'
import { FloatingTerminal } from './FloatingTerminal'
import type { Workspace } from '../types/terminal'
import { AGENT_HUES, STATUS_COLORS } from '../types/terminal'
import { useTerminalStore } from '../store/terminal-store'
import { useUIStore } from '../store/ui-store'

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
  const deleteWorkspace = useTerminalStore((s) => s.deleteWorkspace)
  const promoteAgent = useTerminalStore((s) => s.promoteAgent)
  const workspaces = useTerminalStore((s) => s.workspaces)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  // "Minimize" — send this workspace to the sidebar by promoting another agent.
  // If there's only one workspace, we can't minimize it (nowhere to go).
  const otherWorkspaces = workspaces.filter((w) => w.id !== workspace.id)
  const canMinimize = otherWorkspaces.length > 0

  function handleMinimize() {
    if (!canMinimize) return
    // Promote the next workspace so this one goes to the background deck
    promoteAgent(otherWorkspaces[0].id)
  }

  // Accept workspace-card drops from the sidebar deck
  const [workspaceDragOver, setWorkspaceDragOver] = useState(false)

  function onStageDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('application/x-vessel-workspace')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setWorkspaceDragOver(true)
  }

  function onStageDragLeave(e: React.DragEvent) {
    // Only clear when the cursor truly leaves this element (not just a child)
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setWorkspaceDragOver(false)
  }

  function onStageDrop(e: React.DragEvent) {
    setWorkspaceDragOver(false)
    const id = e.dataTransfer.getData('application/x-vessel-workspace')
    if (!id || id === workspace.id) return
    e.preventDefault()
    promoteAgent(id)
  }

  return (
    <div
      className={`active-stage ${statusClass} w-full h-full flex flex-col`}
      style={{
        '--agent-hue': hue,
        '--status-color': statusColor,
        display: visible ? 'flex' : 'none',
      } as React.CSSProperties}
      onDragOver={onStageDragOver}
      onDragLeave={onStageDragLeave}
      onDrop={onStageDrop}
    >
      {/* Header */}
      <div className="active-stage-header px-5 py-3.5">
        {/* Left: traffic lights + agent name + status */}
        <div className="flex items-center gap-3">
          {/* macOS-style traffic light buttons */}
          <div className="traffic-lights">
            {/* Red — close/delete this workspace */}
            <button
              type="button"
              className="traffic-light traffic-light--red"
              onClick={() => deleteWorkspace(workspace.id)}
              title="Close workspace"
            >
              <span className="tl-icon">✕</span>
            </button>

            {/* Yellow — minimize to sidebar (promote another agent) */}
            <button
              type="button"
              className="traffic-light traffic-light--yellow"
              onClick={handleMinimize}
              disabled={!canMinimize}
              title={canMinimize ? 'Minimize to sidebar' : 'No other workspaces'}
            >
              <span className="tl-icon">−</span>
            </button>

            {/* Green — toggle the agent deck sidebar */}
            <button
              type="button"
              className="traffic-light traffic-light--green"
              onClick={toggleSidebar}
              title="Toggle sidebar"
            >
              <span className="tl-icon">+</span>
            </button>
          </div>

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

      {/* Workspace-swap drop hint — shown when an agent card is dragged over */}
      {workspaceDragOver && (
        <div className="stage-workspace-drop-hint" aria-hidden="true">
          <span className="stage-workspace-drop-label">Swap to stage</span>
        </div>
      )}

      {/* Terminal area */}
      {/* position: relative so FloatingTerminals are positioned relative to this container */}
      <div className="flex-1 min-h-0 relative">
        <div className="w-full h-full overflow-hidden" style={{ backgroundColor: 'var(--terminal-bg)' }}>
          <SplitView node={workspace.root} workspaceId={workspace.id} />
        </div>

        {/* Floating terminal windows — layered above the split view */}
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
    </div>
  )
}
