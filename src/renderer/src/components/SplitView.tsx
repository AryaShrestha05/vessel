import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { TerminalPanel } from './TerminalPanel'
import type { SplitNode } from '../types/terminal'

interface SplitViewProps {
  node: SplitNode
  workspaceId: string
}

export function SplitView({ node, workspaceId }: SplitViewProps) {
  if (node.type === 'leaf') {
    return <TerminalPanel terminalId={node.terminalId} workspaceId={workspaceId} />
  }

  return (
    <Allotment vertical={node.direction === 'vertical'}>
      <Allotment.Pane>
        <SplitView node={node.children[0]} workspaceId={workspaceId} />
      </Allotment.Pane>
      <Allotment.Pane>
        <SplitView node={node.children[1]} workspaceId={workspaceId} />
      </Allotment.Pane>
    </Allotment>
  )
}
