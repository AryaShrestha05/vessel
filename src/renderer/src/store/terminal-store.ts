import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Workspace, SplitNode, AgentStatus } from '../types/terminal'
import { AGENT_HUES } from '../types/terminal'
import { cleanupPtyTracking } from '../hooks/use-terminal'

interface TerminalStore {
  workspaces: Workspace[]
  // The agent currently displayed on the Active Stage
  activeAgentId: string | null

  createWorkspace: (name: string) => void
  deleteWorkspace: (id: string) => void
  promoteAgent: (id: string) => void
  setAgentStatus: (id: string, status: AgentStatus) => void
  splitPane: (workspaceId: string, terminalId: string, direction: 'horizontal' | 'vertical') => void
  closePane: (workspaceId: string, terminalId: string) => void
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

export const useTerminalStore = create<TerminalStore>((set) => ({
  workspaces: [],
  activeAgentId: null,

  createWorkspace: (name: string) => {
    const workspaceId = uuidv4()
    const terminalId = uuidv4()
    const colorId = nextColorIndex++ % AGENT_HUES.length
    const newWorkspace: Workspace = {
      id: workspaceId,
      name,
      root: { type: 'leaf', terminalId },
      terminalIds: [terminalId],
      status: 'idle',
      colorId,
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
