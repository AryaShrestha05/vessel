import { useEffect, useRef, useState } from 'react'
import { useTerminalStore } from './store/terminal-store'
import { useThemeStore } from './store/theme-store'
import { useUIStore } from './store/ui-store'
import { ActiveStage } from './components/ActiveStage'
import { AgentDeck } from './components/AgentDeck'
import { GridView } from './components/GridView'
import { ColorBends } from './components/ColorBends'
import '@xterm/xterm/css/xterm.css'

function App(): React.JSX.Element {
  const workspaces = useTerminalStore((s) => s.workspaces)
  const activeAgentId = useTerminalStore((s) => s.activeAgentId)
  const promoteAgent = useTerminalStore((s) => s.promoteAgent)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const agentsOpen = useUIStore((s) => s.sidebarOpen)
  const setAgentsOpen = useUIStore((s) => s.setSidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const viewMode = useUIStore((s) => s.viewMode)
  const toggleViewMode = useUIStore((s) => s.toggleViewMode)
  const [entered, setEntered] = useState(false)
  const hasEverHadWorkspaces = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 60)
    return () => window.clearTimeout(t)
  }, [])

  // Auto-open the sidebar whenever a terminal pane drag starts so the drop zone is reachable
  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/x-vessel-terminal')) {
        setAgentsOpen(true)
      }
    }
    window.addEventListener('dragstart', onDragStart)
    return () => window.removeEventListener('dragstart', onDragStart)
  }, [setAgentsOpen])

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
  const backgroundCount = sidebarAgents.length

  // Safety net: if activeAgentId points to a deleted workspace (e.g. after a drag
  // operation removes it), auto-promote the first remaining workspace so the stage
  // never shows an empty black screen.
  useEffect(() => {
    if (workspaces.length === 0) return
    if (!activeAgentId || !workspaces.find((w) => w.id === activeAgentId)) {
      promoteAgent(workspaces[0].id)
    }
  }, [workspaces, activeAgentId, promoteAgent])

  // On first launch: open sidebar so the "New agent" input is visible.
  // When the first agent is created: close the sidebar so the terminal fills the view.
  useEffect(() => {
    if (workspaces.length > 0 && !hasEverHadWorkspaces.current) {
      hasEverHadWorkspaces.current = true
      setAgentsOpen(false)
      return
    }
    if (workspaces.length > 0) {
      hasEverHadWorkspaces.current = true
      return
    }
    if (!hasEverHadWorkspaces.current) {
      setAgentsOpen(true)
    }
  }, [workspaces.length])

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
      {/* pl-[76px]: clears the macOS native red/yellow/green traffic lights (they end at ~68px) */}
      <div className={`titlebar-drag-region titlebar-shell h-[44px] shrink-0 flex items-center justify-between pl-[76px] pr-4 enter enter--1 ${entered ? 'enter--in' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="titlebar-theme-btn"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '\u2600' : '\u263E'}
          </button>
        </div>
        <span className="titlebar-label">
          Vessel
        </span>
        <div className="flex items-center gap-2">
          {/* Grid / Focus view toggle */}
          {hasWorkspaces && workspaces.length > 1 && (
            <button
              type="button"
              className="titlebar-menu-btn"
              onClick={toggleViewMode}
              title={viewMode === 'focus' ? 'Grid view' : 'Focus view'}
            >
              {viewMode === 'focus' ? (
                /* 4-square grid icon */
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              ) : (
                /* Single square icon */
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              )}
            </button>
          )}

          {/* Sidebar toggle */}
          <button
            type="button"
            className="titlebar-menu-btn"
            onClick={toggleSidebar}
            title={agentsOpen ? 'Hide agents' : 'Show agents'}
          >
            {agentsOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
            {backgroundCount > 0 && (
              <span className="titlebar-menu-badge" aria-hidden="true">{backgroundCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className={`app-layout flex-1 min-h-0 p-4 pt-2 enter enter--2 ${entered ? 'enter--in' : ''}`}>
        {viewMode === 'grid' && hasWorkspaces ? (
          /* Grid View — all agents visible simultaneously */
          <div className="app-stage min-w-0 relative">
            <GridView workspaces={workspaces} />
          </div>
        ) : (
          /* Focus & Periphery Layout */
          <div className="app-stage min-w-0 relative">
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
        )}

        {/* Agent Deck Sidebar — hidden in grid mode */}
        {viewMode === 'focus' && (
          <div className={`agent-deck-sidebar agent-sidebar enter enter--3 ${entered ? 'enter--in' : ''} ${agentsOpen ? 'agent-sidebar--open' : ''}`}>
            <AgentDeck agents={sidebarAgents} />
          </div>
        )}

        {/* Minimal edge handle when sidebar is hidden (focus mode only) */}
        {viewMode === 'focus' && !agentsOpen && backgroundCount > 0 && (
          <button
            type="button"
            className="agent-sidebar-handle"
            onClick={() => setAgentsOpen(true)}
            title="Show agents"
          >
            <span className="agent-sidebar-handle__chev">‹</span>
            <span className="agent-sidebar-handle__count">{backgroundCount}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default App
