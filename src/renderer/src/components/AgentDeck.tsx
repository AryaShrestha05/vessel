import { useCallback, useState } from 'react'
import type { Workspace } from '../types/terminal'
import { AgentCard } from './AgentCard'
import { CreateAgentMenu } from './CreateAgentMenu'
import { useTerminalStore } from '../store/terminal-store'
import { AGENT_HUES } from '../types/terminal'

const TERMINAL_MIME = 'application/x-vessel-terminal'

interface AgentDeckProps {
  agents: Workspace[]
}

const VISIBLE_CARD_LIMIT = 6

export function AgentDeck({ agents }: AgentDeckProps) {
  const [deckHovered, setDeckHovered] = useState(false)
  const createWorkspace = useTerminalStore((s) => s.createWorkspace)
  const extractToNewWorkspace = useTerminalStore((s) => s.extractToNewWorkspace)
  const [newName, setNewName] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  // Lit when a terminal pane is dragged over the sidebar
  const [terminalDragOver, setTerminalDragOver] = useState(false)

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createWorkspace(name)
    setNewName('')
  }

  const handleRightClickAdd = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuAnchor({ x: rect.right, y: rect.bottom + 6 })
  }, [])

  const closeMenu = useCallback(() => setMenuAnchor(null), [])

  // Pinned agents always stay visible at the top, never overflow
  const pinned = agents.filter((a) => a.pinned)
  const unpinned = agents.filter((a) => !a.pinned)
  const unpinnedLimit = Math.max(0, VISIBLE_CARD_LIMIT - pinned.length)
  const hasOverflow = unpinned.length > unpinnedLimit
  const visibleAgents = [...pinned, ...(hasOverflow ? unpinned.slice(0, unpinnedLimit) : unpinned)]
  const deckAgents = hasOverflow ? unpinned.slice(unpinnedLimit) : []

  function onDeckDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(TERMINAL_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setTerminalDragOver(true)
  }

  function onDeckDragLeave(e: React.DragEvent) {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setTerminalDragOver(false)
  }

  function onDeckDrop(e: React.DragEvent) {
    setTerminalDragOver(false)
    const raw = e.dataTransfer.getData(TERMINAL_MIME)
    if (!raw) return
    e.preventDefault()
    try {
      const { workspaceId, terminalId } = JSON.parse(raw) as { workspaceId: string; terminalId: string }
      if (workspaceId && terminalId) extractToNewWorkspace(workspaceId, terminalId)
    } catch { /* ignore malformed payload */ }
  }

  return (
    <div
      className={`agent-deck h-full flex flex-col px-5 ${terminalDragOver ? 'agent-deck--drop-active' : ''}`}
      onDragOver={onDeckDragOver}
      onDragLeave={onDeckDragLeave}
      onDrop={onDeckDrop}
    >
      {/* Title */}
      <div className="shrink-0 flex items-center justify-center pt-6 pb-5">
        <h2 className="agent-deck-title">
          Agents
          {agents.length > 0 && (
            <span className="agent-deck-count">{agents.length}</span>
          )}
        </h2>
      </div>

      {/* Create input */}
      <div className="shrink-0 pb-5">
        <div className={`agent-deck-input-row ${inputFocused ? 'focused' : ''}`}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="New agent..."
            className="agent-deck-input"
          />
          <button
            onClick={handleCreate}
            onContextMenu={handleRightClickAdd}
            className="agent-deck-add-btn"
            title="Left-click: quick create · Right-click: options"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right-click create menu */}
      {menuAnchor && (
        <CreateAgentMenu
          anchor={menuAnchor}
          initialName={newName}
          onClose={closeMenu}
          onCreated={() => {
            setNewName('')
            closeMenu()
          }}
        />
      )}

      {/* Drop target hint — only shown while a terminal pane is being dragged */}
      <div className={`agent-deck-drop-zone ${terminalDragOver ? 'agent-deck-drop-zone--active' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 4v6M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Drop to background</span>
      </div>

      {/* Agent list */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-5 space-y-4">
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="agent-deck-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <span className="text-[11px] mt-3 text-tertiary-glow">
              No background agents
            </span>
          </div>
        )}

        {visibleAgents.map((agent, index) => (
          <div
            key={agent.id}
            className="group enter-item"
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <AgentCard workspace={agent} />
          </div>
        ))}

        {/* Overflow deck */}
        {deckAgents.length > 0 && (
          <div
            className="relative mt-4 pt-4"
            style={{ borderTop: '1px solid var(--border-primary)' }}
            onMouseEnter={() => setDeckHovered(true)}
            onMouseLeave={() => setDeckHovered(false)}
          >
            <div className="agent-deck-overflow-label">
              +{deckAgents.length} more
            </div>

            <div className={`deck-container ${deckHovered ? 'deck-fanned' : 'deck-stacked'}`}>
              {deckAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  className="deck-card group"
                  style={{
                    '--deck-index': index,
                    '--deck-total': deckAgents.length,
                    '--agent-hue': AGENT_HUES[agent.colorId],
                    zIndex: deckHovered ? deckAgents.length - index : index,
                  } as React.CSSProperties}
                >
                  <AgentCard workspace={agent} compact={!deckHovered} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
