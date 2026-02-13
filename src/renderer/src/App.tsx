import { useEffect, useState } from 'react'
import { useTerminalStore } from './store/terminal-store'
import { useThemeStore } from './store/theme-store'
import { WorkspaceTile } from './components/WorkspaceTile'
import '@xterm/xterm/css/xterm.css'

function App(): React.JSX.Element {
  const workspaces = useTerminalStore((s) => s.workspaces)
  const focusedWorkspaceId = useTerminalStore((s) => s.focusedWorkspaceId)
  const createWorkspace = useTerminalStore((s) => s.createWorkspace)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createWorkspace(name)
    setNewName('')
  }

  const isFocused = focusedWorkspaceId !== null
  const focusedWorkspace = workspaces.find((w) => w.id === focusedWorkspaceId)

  return (
    <div className="w-screen h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Titlebar */}
      <div className="titlebar-drag-region h-[38px] shrink-0 flex items-center justify-between px-20">
        {/* Centered title */}
        <div />
        <span
          className="text-xs font-medium tracking-wide"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Vessel
        </span>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-6 h-6 flex items-center justify-center rounded-md cursor-pointer
                     transition-colors duration-150 text-sm"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* Top bar - create new workspace (always visible, slim when focused) */}
        {!isFocused && (
          <div className="shrink-0 px-4 pb-3">
            <div className="max-w-xl mx-auto flex gap-2">
              <div
                className="glass flex-1 rounded-lg flex items-center overflow-hidden transition-all duration-200
                           focus-within:border-[var(--border-accent)]"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                  placeholder="New terminal workspace..."
                  className="flex-1 px-4 py-2 bg-transparent outline-none text-xs"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <button
                onClick={handleCreate}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer
                           transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
              >
                + New
              </button>
            </div>
          </div>
        )}

        {/* Workspace area */}
        <div className="flex-1 min-h-0 p-2">
          {workspaces.length === 0 ? (
            /* Empty state */
            <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
              <div className="text-5xl mb-4 opacity-10" style={{ color: 'var(--text-primary)' }}>
                &#9002;_
              </div>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Create a workspace to get started
              </p>
            </div>
          ) : isFocused && focusedWorkspace ? (
            /* Focused mode - one workspace takes full area */
            <div className="w-full h-full rounded-lg overflow-hidden animate-scale-in"
                 style={{ border: '1px solid var(--border-primary)' }}>
              <WorkspaceTile workspace={focusedWorkspace} isFocused={true} />
            </div>
          ) : (
            /* Grid mode - all workspaces visible as tiles */
            <div
              className="w-full h-full grid gap-2"
              style={{
                gridTemplateColumns: workspaces.length === 1
                  ? '1fr'
                  : workspaces.length <= 4
                    ? 'repeat(2, 1fr)'
                    : 'repeat(3, 1fr)',
                gridTemplateRows: workspaces.length <= 2
                  ? '1fr'
                  : workspaces.length <= 4
                    ? 'repeat(2, 1fr)'
                    : 'repeat(auto-fill, minmax(200px, 1fr))',
              }}
            >
              {workspaces.map((workspace, index) => (
                <div
                  key={workspace.id}
                  className="rounded-lg overflow-hidden animate-scale-in"
                  style={{
                    border: '1px solid var(--border-primary)',
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <WorkspaceTile workspace={workspace} isFocused={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
