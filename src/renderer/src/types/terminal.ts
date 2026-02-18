// --- DATA STRUCTURES FOR VESSEL ---
//
// These types define the shape of all our data.
// They don't DO anything - they're just blueprints that TypeScript
// uses to make sure we don't make mistakes.

// A terminal session. Each terminal in the app gets one of these.
export interface TerminalSession {
  id: string        // unique ID (e.g. 'abc-123-def')
  title: string     // display name (e.g. 'zsh' or user-set name)
}

// --- THE SPLIT TREE ---
// This is the recursive data structure for pane layouts.
//
// A SplitNode is EITHER a leaf (one terminal) OR a split (two children).
// TypeScript calls this a "discriminated union" - the `type` field tells
// you which variant it is.
//
// Example:
//   if (node.type === 'leaf') {
//     // TypeScript KNOWS node has terminalId here
//   } else {
//     // TypeScript KNOWS node has direction and children here
//   }

export interface LeafNode {
  type: 'leaf'
  terminalId: string   // which terminal session to display
}

export interface SplitNodeBranch {
  type: 'split'
  direction: 'horizontal' | 'vertical'  // how the children are arranged
  children: [SplitNode, SplitNode]       // always exactly 2 children
}

// A SplitNode is one or the other
export type SplitNode = LeafNode | SplitNodeBranch

// --- AGENT STATUS SYSTEM ---
// Color-coded status for agent borders and headers.

export type AgentStatus = 'active' | 'thinking' | 'idle' | 'error'

// Each agent gets a unique hue color for its border.
export const AGENT_HUES = [
  '#818cf8', // indigo
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#fb923c', // orange
  '#4ade80', // green
] as const

// Maps agent status to border color
export const STATUS_COLORS: Record<AgentStatus, string> = {
  active: '#4ade80',   // green
  thinking: '#60a5fa', // blue
  idle: '#6b7280',     // grey
  error: '#f87171',    // red
}

// A workspace is a named collection of terminals with a split layout.
// In the "Focus & Periphery" model, each workspace is an "agent."
export interface Workspace {
  id: string
  name: string          // user-given name like "Backend Server"
  root: SplitNode       // the split tree layout
  terminalIds: string[] // list of all terminal IDs in this workspace
  status: AgentStatus   // current agent status
  colorId: number       // index into AGENT_HUES for unique border hue
}
