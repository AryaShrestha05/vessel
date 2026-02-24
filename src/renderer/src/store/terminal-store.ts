import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Workspace, SplitNode, AgentStatus, FloatedPane } from '../types/terminal'
import { AGENT_HUES } from '../types/terminal'
import { cleanupPtyTracking, setTerminalCwd } from '../hooks/use-terminal'

export interface CreateWorkspaceOptions {
  colorId?: number
  cwd?: string
}

type DockSide = 'left' | 'right' | 'top' | 'bottom'

interface TerminalStore {
  workspaces: Workspace[]
  // The agent currently displayed on the Active Stage
  activeAgentId: string | null

  createWorkspace: (name: string, options?: CreateWorkspaceOptions) => void
  deleteWorkspace: (id: string) => void
  promoteAgent: (id: string) => void
  setAgentStatus: (id: string, status: AgentStatus) => void
  togglePin: (id: string) => void
  splitPane: (workspaceId: string, terminalId: string, direction: 'horizontal' | 'vertical') => void
  closePane: (workspaceId: string, terminalId: string) => void
  dockTerminal: (
    sourceWorkspaceId: string,
    sourceTerminalId: string,
    targetWorkspaceId: string,
    targetTerminalId: string,
    side: DockSide
  ) => void
  // Float mode: detach a pane from the split tree into a free-floating window
  floatPane: (workspaceId: string, terminalId: string) => void
  unfloatPane: (workspaceId: string, terminalId: string) => void
  updateFloatPane: (workspaceId: string, terminalId: string, update: Partial<Pick<FloatedPane, 'x' | 'y' | 'width' | 'height'>>) => void
  bringFloatToFront: (workspaceId: string, terminalId: string) => void
  // Send a pane to the background deck as its own new workspace
  extractToNewWorkspace: (sourceWorkspaceId: string, terminalId: string, name?: string) => void
}

let nextColorIndex = 0

// How many leaf (terminal) nodes are in a split tree
function countLeaves(node: SplitNode): number {
  if (node.type === 'leaf') return 1
  return countLeaves(node.children[0]) + countLeaves(node.children[1])
}

function mapTree(node: SplitNode, targetTerminalId: string, transform: (leaf: SplitNode) => SplitNode): SplitNode {
  if (node.type === 'leaf') {
    if (node.terminalId === targetTerminalId) return transform(node)
    return node
  }
  return {
    ...node,
    children: [
      mapTree(node.children[0], targetTerminalId, transform),
      mapTree(node.children[1], targetTerminalId, transform)
    ]
  }
}

function removeFromTree(node: SplitNode, targetTerminalId: string): SplitNode | null {
  if (node.type === 'leaf') {
    if (node.terminalId === targetTerminalId) return null
    return node
  }
  const left = removeFromTree(node.children[0], targetTerminalId)
  const right = removeFromTree(node.children[1], targetTerminalId)
  if (left && right) return { ...node, children: [left, right] }
  if (left) return left
  if (right) return right
  return null
}

function splitWithIncoming(targetTerminalId: string, incomingTerminalId: string, side: DockSide): SplitNode {
  const direction: 'horizontal' | 'vertical' = (side === 'left' || side === 'right') ? 'horizontal' : 'vertical'
  const incomingLeaf: SplitNode = { type: 'leaf', terminalId: incomingTerminalId }
  const targetLeaf: SplitNode = { type: 'leaf', terminalId: targetTerminalId }
  const incomingFirst = side === 'left' || side === 'top'
  return {
    type: 'split' as const,
    direction,
    children: (incomingFirst ? [incomingLeaf, targetLeaf] : [targetLeaf, incomingLeaf]) as [SplitNode, SplitNode],
  }
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  workspaces: [],
  activeAgentId: null,

  createWorkspace: (name: string, options?: CreateWorkspaceOptions) => {
    const workspaceId = uuidv4()
    const terminalId = uuidv4()
    const colorId = options?.colorId ?? nextColorIndex++ % AGENT_HUES.length
    if (options?.cwd) {
      setTerminalCwd(terminalId, options.cwd)
    }
    const newWorkspace: Workspace = {
      id: workspaceId,
      name,
      root: { type: 'leaf', terminalId },
      terminalIds: [terminalId],
      status: 'idle',
      colorId,
      pinned: false,
      floatedPanes: [],
    }
    set((state) => {
      const isFirst = state.workspaces.length === 0 && state.activeAgentId === null
      return {
        workspaces: [...state.workspaces, newWorkspace],
        // Auto-promote first agent to Active Stage
        activeAgentId: isFirst ? workspaceId : state.activeAgentId,
      }
    })
  },

  deleteWorkspace: (id: string) => {
    set((state) => {
      const workspace = state.workspaces.find((w) => w.id === id)
      if (workspace) {
        for (const terminalId of workspace.terminalIds) {
          window.terminalAPI.destroy(terminalId)
          cleanupPtyTracking(terminalId)
        }
      }
      const remaining = state.workspaces.filter((w) => w.id !== id)
      let newActiveId = state.activeAgentId
      if (state.activeAgentId === id) {
        // Promote the first remaining agent, or null
        newActiveId = remaining.length > 0 ? remaining[0].id : null
      }
      return {
        workspaces: remaining,
        activeAgentId: newActiveId,
      }
    })
  },

  promoteAgent: (id: string) => {
    set({ activeAgentId: id })
  },

  setAgentStatus: (id: string, status: AgentStatus) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, status } : w
      ),
    }))
  },

  togglePin: (id: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, pinned: !w.pinned } : w
      ),
    }))
  },

  splitPane: (workspaceId: string, terminalId: string, direction: 'horizontal' | 'vertical') => {
    const newTerminalId = uuidv4()
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== workspaceId) return w
        // Hard cap: no more than 4 terminal panes per workspace
        if (w.terminalIds.length >= 4) return w
        const newRoot = mapTree(w.root, terminalId, () => ({
          type: 'split' as const,
          direction,
          children: [
            { type: 'leaf' as const, terminalId },
            { type: 'leaf' as const, terminalId: newTerminalId }
          ] as [SplitNode, SplitNode]
        }))
        return {
          ...w,
          root: newRoot,
          terminalIds: [...w.terminalIds, newTerminalId]
        }
      })
    }))
  },

  closePane: (workspaceId: string, terminalId: string) => {
    window.terminalAPI.destroy(terminalId)
    cleanupPtyTracking(terminalId)
    set((state) => {
      const workspace = state.workspaces.find((w) => w.id === workspaceId)
      if (!workspace) return state
      const newRoot = removeFromTree(workspace.root, terminalId)

      // Last docked pane closed — delete the whole workspace
      if (!newRoot) {
        const remaining = state.workspaces.filter((w) => w.id !== workspaceId)
        const newActiveId = state.activeAgentId === workspaceId
          ? (remaining.length > 0 ? remaining[0].id : null)
          : state.activeAgentId
        return { workspaces: remaining, activeAgentId: newActiveId }
      }

      return {
        workspaces: state.workspaces.map((w) => {
          if (w.id !== workspaceId) return w
          return {
            ...w,
            root: newRoot,
            terminalIds: w.terminalIds.filter((id) => id !== terminalId),
            // Also evict from floatedPanes in case the terminal was floating
            floatedPanes: w.floatedPanes.filter((p) => p.terminalId !== terminalId),
          }
        }),
      }
    })
  },

  dockTerminal: (sourceWorkspaceId, sourceTerminalId, targetWorkspaceId, targetTerminalId, side) => {
    if (sourceTerminalId === targetTerminalId) return

    set((state) => {
      const sourceWs = state.workspaces.find((w) => w.id === sourceWorkspaceId)
      const targetWs = state.workspaces.find((w) => w.id === targetWorkspaceId)
      if (!sourceWs || !targetWs) return state
      if (!sourceWs.terminalIds.includes(sourceTerminalId)) return state
      if (sourceWorkspaceId !== targetWorkspaceId && targetWs.terminalIds.includes(sourceTerminalId)) return state

      // Moving within the same workspace: remove the terminal leaf and re-insert as a split on the target leaf.
      if (sourceWorkspaceId === targetWorkspaceId) {
        if (sourceWs.terminalIds.length < 2) return state
        const pruned = removeFromTree(sourceWs.root, sourceTerminalId)
        if (!pruned) return state

        const newRoot = mapTree(pruned, targetTerminalId, () =>
          splitWithIncoming(targetTerminalId, sourceTerminalId, side)
        )
        if (newRoot === pruned) return state

        return {
          ...state,
          workspaces: state.workspaces.map((w) =>
            w.id === sourceWorkspaceId ? { ...w, root: newRoot } : w
          ),
        }
      }

      // Hard cap: target workspace can't exceed 4 panes when receiving from another workspace
      if (targetWs.terminalIds.length >= 4) return state

      const prunedSourceRoot = removeFromTree(sourceWs.root, sourceTerminalId)
      // If the source workspace becomes empty, we'll delete it entirely
      const sourceBecomesEmpty = !prunedSourceRoot

      const newTargetRoot = mapTree(targetWs.root, targetTerminalId, () =>
        splitWithIncoming(targetTerminalId, sourceTerminalId, side)
      )
      // If targetTerminalId wasn't found in the tree, nothing to do
      if (newTargetRoot === targetWs.root) return state

      const updated = state.workspaces
        .filter((w) => !(w.id === sourceWorkspaceId && sourceBecomesEmpty))
        .map((w) => {
          if (w.id === sourceWorkspaceId) {
            return {
              ...w,
              root: prunedSourceRoot!,
              terminalIds: w.terminalIds.filter((id) => id !== sourceTerminalId),
            }
          }
          if (w.id === targetWorkspaceId) {
            return { ...w, root: newTargetRoot, terminalIds: [...w.terminalIds, sourceTerminalId] }
          }
          return w
        })

      // If the active workspace was the one we just deleted, promote another
      let newActiveId = state.activeAgentId
      if (sourceBecomesEmpty && state.activeAgentId === sourceWorkspaceId) {
        newActiveId = updated.length > 0 ? updated[0].id : null
      }

      return { ...state, workspaces: updated, activeAgentId: newActiveId }
    })
  },

  // Pop a terminal out of the split tree into a free-floating window.
  // Refuses if it's the only terminal remaining in the tree (nothing to dock into).
  floatPane: (workspaceId, terminalId) => {
    set((state) => {
      const ws = state.workspaces.find((w) => w.id === workspaceId)
      if (!ws) return state
      if (!ws.terminalIds.includes(terminalId)) return state

      // Don't float the last docked terminal — the split area must stay non-empty
      if (countLeaves(ws.root) <= 1) return state

      const newRoot = removeFromTree(ws.root, terminalId)
      if (!newRoot) return state

      // Stack new windows with a slight cascade offset
      const maxZ = ws.floatedPanes.reduce((m, p) => Math.max(m, p.zIndex), 99)
      const offset = ws.floatedPanes.length * 24
      const newPane: FloatedPane = {
        terminalId,
        x: 40 + offset,
        y: 40 + offset,
        width: 560,
        height: 360,
        zIndex: maxZ + 1,
      }

      return {
        workspaces: state.workspaces.map((w) =>
          w.id !== workspaceId ? w : { ...w, root: newRoot, floatedPanes: [...w.floatedPanes, newPane] }
        ),
      }
    })
  },

  // Dock a floating terminal back into the split tree as a new right-side split.
  unfloatPane: (workspaceId, terminalId) => {
    set((state) => {
      const ws = state.workspaces.find((w) => w.id === workspaceId)
      if (!ws) return state
      if (!ws.floatedPanes.some((p) => p.terminalId === terminalId)) return state

      const newLeaf: SplitNode = { type: 'leaf', terminalId }
      const newRoot: SplitNode = {
        type: 'split',
        direction: 'horizontal',
        children: [ws.root, newLeaf],
      }

      return {
        workspaces: state.workspaces.map((w) =>
          w.id !== workspaceId ? w : {
            ...w,
            root: newRoot,
            floatedPanes: w.floatedPanes.filter((p) => p.terminalId !== terminalId),
          }
        ),
      }
    })
  },

  // Update position and/or size of a floating pane (called on drag/resize end).
  updateFloatPane: (workspaceId, terminalId, update) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id !== workspaceId ? w : {
          ...w,
          floatedPanes: w.floatedPanes.map((p) =>
            p.terminalId !== terminalId ? p : { ...p, ...update }
          ),
        }
      ),
    }))
  },

  // Drag a pane from the active stage to the sidebar — it becomes its own background workspace.
  extractToNewWorkspace: (sourceWorkspaceId, terminalId, name) => {
    set((state) => {
      const sourceWs = state.workspaces.find((w) => w.id === sourceWorkspaceId)
      if (!sourceWs) return state
      if (!sourceWs.terminalIds.includes(terminalId)) return state

      // Can't extract if it would leave the source workspace with zero panes
      if (sourceWs.terminalIds.length <= 1) return state

      const newRoot = removeFromTree(sourceWs.root, terminalId)
      if (!newRoot) return state // was the last docked pane — blocked

      const newWorkspaceId = uuidv4()
      const colorId = nextColorIndex++ % AGENT_HUES.length
      const newWorkspace: Workspace = {
        id: newWorkspaceId,
        name: name ?? sourceWs.name,
        root: { type: 'leaf', terminalId },
        terminalIds: [terminalId],
        status: 'idle',
        colorId,
        pinned: false,
        floatedPanes: [],
      }

      return {
        workspaces: [
          ...state.workspaces.map((w) =>
            w.id !== sourceWorkspaceId ? w : {
              ...w,
              root: newRoot,
              terminalIds: w.terminalIds.filter((id) => id !== terminalId),
            }
          ),
          newWorkspace, // appended → lands at the bottom of the sidebar deck
        ],
      }
    })
  },

  // Raise a floating pane to the top of the stack.
  bringFloatToFront: (workspaceId, terminalId) => {
    set((state) => {
      const ws = state.workspaces.find((w) => w.id === workspaceId)
      if (!ws) return state
      const pane = ws.floatedPanes.find((p) => p.terminalId === terminalId)
      if (!pane) return state
      const maxZ = ws.floatedPanes.reduce((m, p) => Math.max(m, p.zIndex), 0)
      if (pane.zIndex === maxZ) return state // already on top

      return {
        workspaces: state.workspaces.map((w) =>
          w.id !== workspaceId ? w : {
            ...w,
            floatedPanes: w.floatedPanes.map((p) =>
              p.terminalId !== terminalId ? p : { ...p, zIndex: maxZ + 1 }
            ),
          }
        ),
      }
    })
  },
}))
