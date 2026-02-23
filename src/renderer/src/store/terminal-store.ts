import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Workspace, SplitNode, AgentStatus } from '../types/terminal'
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
}

let nextColorIndex = 0

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

      // Last pane closed — delete the whole workspace instead of spawning a new terminal
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
          return { ...w, root: newRoot, terminalIds: w.terminalIds.filter((id) => id !== terminalId) }
        }),
      }
    })
  },

  dockTerminal: (sourceWorkspaceId, sourceTerminalId, targetWorkspaceId, targetTerminalId, side) => {
    if (sourceWorkspaceId === targetWorkspaceId) return
    if (sourceTerminalId === targetTerminalId) return

    set((state) => {
      const sourceWs = state.workspaces.find((w) => w.id === sourceWorkspaceId)
      const targetWs = state.workspaces.find((w) => w.id === targetWorkspaceId)
      if (!sourceWs || !targetWs) return state
      if (!sourceWs.terminalIds.includes(sourceTerminalId)) return state
      if (targetWs.terminalIds.includes(sourceTerminalId)) return state

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
}))
