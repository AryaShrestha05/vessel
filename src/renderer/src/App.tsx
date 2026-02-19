import { useEffect } from 'react'
import { useTerminalStore } from './store/terminal-store'
import { useThemeStore } from './store/theme-store'
import { ActiveStage } from './components/ActiveStage'
import { AgentDeck } from './components/AgentDeck'
import { ColorBends } from './components/ColorBends'
import '@xterm/xterm/css/xterm.css'

function App(): React.JSX.Element {
  const workspaces = useTerminalStore((s) => s.workspaces)
  const activeAgentId = useTerminalStore((s) => s.activeAgentId)
  const promoteAgent = useTerminalStore((s) => s.promoteAgent)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Cmd+K to cycle to next agent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        const len = workspaces.length
        if (len < 2) return
        const currentIndex = workspaces.findIndex((w) => w.id === activeAgentId)
        const nextIndex = (currentIndex + 1) % len
        promoteAgent(workspaces[nextIndex].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [workspaces, activeAgentId, promoteAgent])

  const sidebarAgents = workspaces.filter((w) => w.id !== activeAgentId)
  const hasWorkspaces = workspaces.length > 0

  return (
    <div className="w-screen h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Animated shader background */}
      <div className="colorbends-bg">
        <ColorBends
          rotation={10}
          speed={0.25}
          colors={['#1f69ff', '#29cb10', '#f51414']}
          transparent
          autoRotate={0.05}
          scale={1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={0.3}
          parallax={0.4}
          noise={0.5}
        />
      </div>

      {/* Titlebar */}
      <div className="titlebar-drag-region h-[38px] shrink-0 flex items-center justify-between px-20">
        <div />
        <span className="titlebar-label">
          Vessel
        </span>
        <button
          onClick={toggleTheme}
          className="titlebar-theme-btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>

      {/* Focus & Periphery Layout */}
      <div className="flex-1 min-h-0 flex gap-4 p-4 pt-2">
        {/* Active Stage (~70%) - render ALL workspaces, toggle visibility */}
        <div className="flex-1 min-w-0 relative">
          {!hasWorkspaces && (
            <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
              <div className="empty-state-icon">&#9002;_</div>
              <p className="empty-state-text">Create an agent to get started</p>
            </div>
          )}

          {workspaces.map((workspace) => (
            <ActiveStage
              key={workspace.id}
              workspace={workspace}
              visible={workspace.id === activeAgentId}
            />
          ))}
        </div>

        {/* Agent Deck Sidebar */}
        <div className="agent-deck-sidebar shrink-0" style={{ width: 340 }}>
          <AgentDeck agents={sidebarAgents} />
        </div>
      </div>
    </div>
  )
}

export default App
