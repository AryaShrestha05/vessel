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

// A workspace is a named collection of terminals with a split layout.
// Each "box" on the home screen is one workspace.
export interface Workspace {
  id: string
  name: string          // user-given name like "Backend Server"
  root: SplitNode       // the split tree layout
  terminalIds: string[] // list of all terminal IDs in this workspace
}
