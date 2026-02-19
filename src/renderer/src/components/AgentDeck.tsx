import { useState } from 'react'
import type { Workspace } from '../types/terminal'
import { AgentCard } from './AgentCard'
import { useTerminalStore } from '../store/terminal-store'
import { AGENT_HUES } from '../types/terminal'

interface AgentDeckProps {
  agents: Workspace[]
}

const VISIBLE_CARD_LIMIT = 6

export function AgentDeck({ agents }: AgentDeckProps) {
  const [deckHovered, setDeckHovered] = useState(false)
  const createWorkspace = useTerminalStore((s) => s.createWorkspace)
  const [newName, setNewName] = useState('')
  const [inputFocused, setInputFocused] = useState(false)

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createWorkspace(name)
    setNewName('')
  }

  const hasOverflow = agents.length > VISIBLE_CARD_LIMIT
  const visibleAgents = hasOverflow ? agents.slice(0, VISIBLE_CARD_LIMIT) : agents
  const deckAgents = hasOverflow ? agents.slice(VISIBLE_CARD_LIMIT) : []

  return (
    <div className="agent-deck h-full flex flex-col px-5">
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
          <button onClick={handleCreate} className="agent-deck-add-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
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
