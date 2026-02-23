import { useRef, useLayoutEffect } from 'react'
import { useTerminal } from '../hooks/use-terminal'
import { useTerminalStore } from '../store/terminal-store'
import type { FloatedPane } from '../types/terminal'

interface FloatingTerminalProps {
  terminalId: string
  workspaceId: string
  pane: FloatedPane
  workspaceName: string
}

type ResizeEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

interface DragState {
  mouseX: number
  mouseY: number
  panelX: number
  panelY: number
}

interface ResizeState {
  edge: ResizeEdge
  mouseX: number
  mouseY: number
  panelX: number
  panelY: number
  panelW: number
  panelH: number
}

const MIN_W = 340   // enough for ~48 mono chars at default font size
const MIN_H = 240   // titlebar (40) + at least 8 usable terminal lines
const TITLEBAR_H = 40

function computeResize(dx: number, dy: number, state: ResizeState) {
  const { edge, panelX, panelY, panelW, panelH } = state
  let x = panelX, y = panelY, w = panelW, h = panelH

  if (edge.includes('e')) w = Math.max(MIN_W, panelW + dx)
  if (edge.includes('s')) h = Math.max(MIN_H, panelH + dy)
  if (edge.includes('w')) {
    const clamped = Math.max(MIN_W, panelW - dx)
    x = panelX + panelW - clamped
    w = clamped
  }
  if (edge.includes('n')) {
    const clamped = Math.max(MIN_H, panelH - dy)
    y = panelY + panelH - clamped
    h = clamped
  }
  return { x, y, width: w, height: h }
}

export function FloatingTerminal({ terminalId, workspaceId, pane, workspaceName }: FloatingTerminalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mounts a new xterm instance; replays buffer so history is preserved
  useTerminal(containerRef, terminalId)

  const unfloatPane = useTerminalStore((s) => s.unfloatPane)
  const updateFloatPane = useTerminalStore((s) => s.updateFloatPane)
  const bringFloatToFront = useTerminalStore((s) => s.bringFloatToFront)
  const closePane = useTerminalStore((s) => s.closePane)

  // Apply initial position imperatively — avoids re-render loops
  // and ensures the panel is at the correct location before first paint.
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    el.style.left = `${pane.x}px`
    el.style.top = `${pane.y}px`
    el.style.width = `${pane.width}px`
    el.style.height = `${pane.height}px`
  }, []) // intentionally only on mount

  // Sync position/size from store changes that originate outside this component
  // (e.g. if another part of the app repositions the pane).
  // We skip this during an active drag/resize via the refs below.
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  useLayoutEffect(() => {
    if (dragRef.current || resizeRef.current) return
    const el = panelRef.current
    if (!el) return
    el.style.left = `${pane.x}px`
    el.style.top = `${pane.y}px`
    el.style.width = `${pane.width}px`
    el.style.height = `${pane.height}px`
  }, [pane.x, pane.y, pane.width, pane.height])

  // ─── Drag (title bar) ────────────────────────────────────────────────────
  function onTitleBarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    // Don't start drag when clicking the traffic lights or buttons
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    bringFloatToFront(workspaceId, terminalId)
    dragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: (panelRef.current ? parseInt(panelRef.current.style.left, 10) : NaN) || pane.x,
      panelY: (panelRef.current ? parseInt(panelRef.current.style.top, 10) : NaN) || pane.y,
    }
  }

  function onTitleBarPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !panelRef.current) return
    const x = dragRef.current.panelX + (e.clientX - dragRef.current.mouseX)
    const y = Math.max(0, dragRef.current.panelY + (e.clientY - dragRef.current.mouseY))
    panelRef.current.style.left = `${x}px`
    panelRef.current.style.top = `${y}px`
  }

  function onTitleBarPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !panelRef.current) return
    const x = dragRef.current.panelX + (e.clientX - dragRef.current.mouseX)
    const y = Math.max(0, dragRef.current.panelY + (e.clientY - dragRef.current.mouseY))
    updateFloatPane(workspaceId, terminalId, { x, y })
    dragRef.current = null
  }

  // ─── Resize ──────────────────────────────────────────────────────────────
  function onResizePointerDown(edge: ResizeEdge, e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    bringFloatToFront(workspaceId, terminalId)
    const el = panelRef.current
    // Use || fallback: parseInt returns NaN on empty/unset style, and
    // Math.max(MIN_W, NaN) === NaN in JS, which would collapse the window to 0.
    resizeRef.current = {
      edge,
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: (el ? parseInt(el.style.left, 10) : NaN) || pane.x,
      panelY: (el ? parseInt(el.style.top, 10) : NaN) || pane.y,
      panelW: (el ? parseInt(el.style.width, 10) : NaN) || pane.width,
      panelH: (el ? parseInt(el.style.height, 10) : NaN) || pane.height,
    }
  }

  function onResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current || !panelRef.current) return
    const dx = e.clientX - resizeRef.current.mouseX
    const dy = e.clientY - resizeRef.current.mouseY
    const { x, y, width, height } = computeResize(dx, dy, resizeRef.current)
    panelRef.current.style.left = `${x}px`
    panelRef.current.style.top = `${y}px`
    panelRef.current.style.width = `${width}px`
    panelRef.current.style.height = `${height}px`
  }

  function onResizePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current || !panelRef.current) return
    const dx = e.clientX - resizeRef.current.mouseX
    const dy = e.clientY - resizeRef.current.mouseY
    const bounds = computeResize(dx, dy, resizeRef.current)
    updateFloatPane(workspaceId, terminalId, bounds)
    resizeRef.current = null
  }

  // Bring to front on any pointer interaction with the window
  function onWindowPointerDown() {
    bringFloatToFront(workspaceId, terminalId)
  }

  return (
    <div
      ref={panelRef}
      className="floating-terminal"
      style={{ zIndex: pane.zIndex }}
      onPointerDown={onWindowPointerDown}
    >
      {/* ── Resize handles (8-directional) ─────────────────────────────── */}
      {(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as ResizeEdge[]).map((edge) => (
        <div
          key={edge}
          className={`ft-resize ft-resize--${edge}`}
          onPointerDown={(e) => onResizePointerDown(edge, e)}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
        />
      ))}

      {/* ── Title bar (drag to move) ─────────────────────────────────────── */}
      <div
        className="floating-terminal__titlebar"
        style={{ height: TITLEBAR_H }}
        onPointerDown={onTitleBarPointerDown}
        onPointerMove={onTitleBarPointerMove}
        onPointerUp={onTitleBarPointerUp}
      >
        {/* Traffic lights */}
        <div className="traffic-lights" style={{ flexShrink: 0 }}>
          <button
            type="button"
            className="traffic-light traffic-light--red"
            onClick={(e) => { e.stopPropagation(); closePane(workspaceId, terminalId) }}
            title="Close terminal"
          >
            <span className="tl-icon">✕</span>
          </button>
          <button
            type="button"
            className="traffic-light traffic-light--yellow"
            onClick={(e) => { e.stopPropagation(); unfloatPane(workspaceId, terminalId) }}
            title="Dock back to split view"
          >
            {/* "dock back" minus/arrow symbol */}
            <span className="tl-icon" style={{ fontSize: 9, lineHeight: 1 }}>⊟</span>
          </button>
          <button
            type="button"
            className="traffic-light traffic-light--green"
            disabled
            title="Maximize (not available in float mode)"
          />
        </div>

        {/* Centered window title */}
        <span className="floating-terminal__title">{workspaceName}</span>

        {/* Dock-back action button on the right */}
        <button
          type="button"
          className="ft-dock-btn"
          onClick={(e) => { e.stopPropagation(); unfloatPane(workspaceId, terminalId) }}
          title="Dock back to split view"
        >
          {/* Arrow pointing into a box (dock icon) */}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="0.75" y="0.75" width="9.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M5.5 3v5M3 6l2.5 2.5L8 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Terminal content ─────────────────────────────────────────────── */}
      <div className="floating-terminal__content">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}
