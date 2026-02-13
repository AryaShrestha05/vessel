import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Workspace, SplitNode } from '../types/terminal'

interface TerminalStore {
  workspaces: Workspace[]
  // null = grid view (all visible), string = one workspace is focused/expanded
  focusedWorkspaceId: string | null

  createWorkspace: (name: string) => void
  deleteWorkspace: (id: string) => void
  focusWorkspace: (id: string) => void
  unfocus: () => void
  splitPane: (workspaceId: string, terminalId: string, direction: 'horizontal' | 'vertical') => void
  closePane: (workspaceId: string, terminalId: string) => void
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

export const useTerminalStore = create<TerminalStore>((set) => ({
  workspaces: [],
  focusedWorkspaceId: null,

  createWorkspace: (name: string) => {
    const workspaceId = uuidv4()
    const terminalId = uuidv4()
    const newWorkspace: Workspace = {
      id: workspaceId,
      name,
      root: { type: 'leaf', terminalId },
      terminalIds: [terminalId]
    }
    set((state) => ({
      workspaces: [...state.workspaces, newWorkspace]
    }))
  },

  deleteWorkspace: (id: string) => {
    set((state) => {
      const workspace = state.workspaces.find((w) => w.id === id)
      if (workspace) {
        for (const terminalId of workspace.terminalIds) {
          window.terminalAPI.destroy(terminalId)
        }
      }
      return {
        workspaces: state.workspaces.filter((w) => w.id !== id),
        focusedWorkspaceId: state.focusedWorkspaceId === id ? null : state.focusedWorkspaceId
      }
    })
  },

  focusWorkspace: (id: string) => {
    set({ focusedWorkspaceId: id })
  },

  unfocus: () => {
    set({ focusedWorkspaceId: null })
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
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== workspaceId) return w
        const newRoot = removeFromTree(w.root, terminalId)
        if (!newRoot) {
          const freshTerminalId = uuidv4()
          return {
            ...w,
            root: { type: 'leaf' as const, terminalId: freshTerminalId },
            terminalIds: [freshTerminalId]
          }
        }
        return {
          ...w,
          root: newRoot,
          terminalIds: w.terminalIds.filter((id) => id !== terminalId)
        }
      })
    }))
  }
}))
