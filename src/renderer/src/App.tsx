import { useEffect } from 'react'
import { useTerminalStore } from './store/terminal-store'
import { useThemeStore } from './store/theme-store'
import { ActiveStage } from './components/ActiveStage'
import { AgentDeck } from './components/AgentDeck'
import { ColorBends } from './components/ColorBends'
import GlassSurface from './components/GlassSurface'
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
          rotation={35}
          speed={0.15}
          colors={['#0f172a', '#1e1b4b', '#164e63', '#0c0a09']}
          transparent
          autoRotate={0.3}
          scale={1.1}
          frequency={0.8}
          warpStrength={0.7}
          mouseInfluence={0.3}
          parallax={0.4}
          noise={0.3}
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
      <div className="flex-1 min-h-0 flex gap-2 p-2 pt-0">
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

        {/* Agent Deck Sidebar - Liquid Glass */}
        <GlassSurface
          width="340px"
          height="100%"
          borderRadius={14}
          blur={20}
          brightness={30}
          opacity={0.6}
          backgroundOpacity={0.02}
          saturation={1.6}
          borderWidth={0.03}
          className="shrink-0"
        >
          <AgentDeck agents={sidebarAgents} />
        </GlassSurface>
      </div>
    </div>
  )
}

export default App
