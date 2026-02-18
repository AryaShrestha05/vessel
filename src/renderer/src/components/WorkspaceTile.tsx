import { SplitView } from './SplitView'
import { useTerminalStore } from '../store/terminal-store'
import type { Workspace } from '../types/terminal'

// A workspace tile that shows a live terminal.
// In grid mode: small card with label overlay.
// In focused mode: takes the full area, no overlay.

interface WorkspaceTileProps {
  workspace: Workspace
  isFocused: boolean
}

export function WorkspaceTile({ workspace, isFocused }: WorkspaceTileProps) {
  const focusWorkspace = useTerminalStore((s) => s.focusWorkspace)
  const unfocus = useTerminalStore((s) => s.unfocus)
  const deleteWorkspace = useTerminalStore((s) => s.deleteWorkspace)

  return (
    <div className="w-full h-full relative group" style={{ backgroundColor: 'var(--terminal-bg)' }}>
      {/* The live terminal - always rendered, always alive */}
      <div className="w-full h-full overflow-hidden">
        <SplitView node={workspace.root} workspaceId={workspace.id} />
      </div>

      {/* Overlay label + controls - only in grid mode (not focused) */}
      {!isFocused && (
        <>
          {/* Click target to focus */}
          <div
            onClick={() => focusWorkspace(workspace.id)}
            className="absolute inset-0 cursor-pointer z-10"
          />

          {/* Bottom label bar */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between
                       px-3 py-2 transition-opacity duration-200"
            style={{
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            }}
          >
            <span className="text-xs font-medium text-white/90 truncate">
              {workspace.name}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  focusWorkspace(workspace.id)
                }}
                className="px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer
                           bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
              >
                Expand
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteWorkspace(workspace.id)
                }}
                className="px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer
                           bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Back button - only in focused mode */}
      {isFocused && (
        <button
          onClick={unfocus}
          className="absolute top-2 left-2 z-20 glass rounded-lg px-3 py-1.5
                     text-xs font-medium cursor-pointer transition-all duration-200
                     opacity-0 group-hover:opacity-100 hover:scale-105"
          style={{ color: 'var(--text-secondary)' }}
        >
          &#8592; Grid
        </button>
      )}
    </div>
  )
}
