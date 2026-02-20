import { useEffect, useRef, useState } from 'react'
import { AGENT_HUES } from '../types/terminal'
import { useTerminalStore } from '../store/terminal-store'

interface CreateAgentMenuProps {
  /** Anchor position (bottom-right of the '+' button) */
  anchor: { x: number; y: number }
  /** Pre-filled name from the input field */
  initialName: string
  onClose: () => void
  onCreated: () => void
}

export function CreateAgentMenu({ anchor, initialName, onClose, onCreated }: CreateAgentMenuProps) {
  const createWorkspace = useTerminalStore((s) => s.createWorkspace)
  const menuRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [selectedColor, setSelectedColor] = useState<number | null>(null)
  const [cwd, setCwd] = useState<string | null>(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Focus the name input on mount
  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const handleBrowse = async () => {
    const dir = await window.terminalAPI.pickDirectory()
    if (dir) setCwd(dir)
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createWorkspace(trimmed, {
      colorId: selectedColor ?? undefined,
      cwd: cwd ?? undefined,
    })
    onCreated()
  }

  // Shorten a path for display: /Users/foo/projects/bar → ~/projects/bar
  const displayPath = (p: string) => {
    const home = '/Users/'
    if (p.startsWith(home)) {
      const rest = p.slice(home.length)
      const slashIdx = rest.indexOf('/')
      if (slashIdx !== -1) return '~' + rest.slice(slashIdx)
      return '~'
    }
    return p
  }

  return (
    <div
      ref={menuRef}
      className="create-agent-menu"
      style={{ top: anchor.y, right: window.innerWidth - anchor.x }}
    >
      {/* Name */}
      <label className="create-agent-menu-label">Name</label>
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
        placeholder="Agent name..."
        className="create-agent-menu-input"
      />

      {/* Color */}
      <label className="create-agent-menu-label">Color</label>
      <div className="create-agent-menu-colors">
        {AGENT_HUES.map((hue, index) => (
          <button
            key={hue}
            className={`create-agent-menu-swatch ${selectedColor === index ? 'create-agent-menu-swatch--selected' : ''}`}
            style={{ backgroundColor: hue }}
            onClick={() => setSelectedColor(selectedColor === index ? null : index)}
            title={hue}
          />
        ))}
      </div>

      {/* Working directory */}
      <label className="create-agent-menu-label">Working directory</label>
      <div className="create-agent-menu-cwd-row">
        <span className="create-agent-menu-cwd-path">
          {cwd ? displayPath(cwd) : 'Default (home)'}
        </span>
        <button onClick={handleBrowse} className="create-agent-menu-browse-btn">
          Browse
        </button>
      </div>

      {/* Create */}
      <button
        onClick={handleCreate}
        disabled={!name.trim()}
        className="create-agent-menu-create-btn"
      >
        Create agent
      </button>
    </div>
  )
}
