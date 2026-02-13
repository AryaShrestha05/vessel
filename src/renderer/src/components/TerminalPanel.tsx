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

      {/* Floating toolbar on hover */}
      <div
        className="absolute top-2 right-2 flex gap-1 z-10 transition-all duration-200"
        style={{
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(-4px)',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        <div className="glass rounded-lg flex gap-0.5 p-0.5">
          <button
            onClick={() => splitPane(workspaceId, terminalId, 'horizontal')}
            title="Split right"
            className="w-7 h-6 rounded-md text-xs flex items-center justify-center
                       font-[Geist_Mono] cursor-pointer transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            &#x258F;&#x2595;
          </button>
          <button
            onClick={() => splitPane(workspaceId, terminalId, 'vertical')}
            title="Split down"
            className="w-7 h-6 rounded-md text-xs flex items-center justify-center
                       font-[Geist_Mono] cursor-pointer transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            &#x2581;&#x2594;
          </button>
          <div
            className="w-px mx-0.5"
            style={{ backgroundColor: 'var(--border-primary)' }}
          />
          <button
            onClick={() => closePane(workspaceId, terminalId)}
            title="Close"
            className="w-7 h-6 rounded-md text-xs flex items-center justify-center
                       cursor-pointer transition-colors duration-150"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger)'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--danger)'
            }}
          >
            &#10005;
          </button>
        </div>
      </div>
    </div>
  )
}
