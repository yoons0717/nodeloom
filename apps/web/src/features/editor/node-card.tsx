'use client';

import { type GraphNode, type Issue, NODE_SPECS } from '@nodeloom/core';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NODE_META, PORT_LABEL } from './node-meta';

export type CanvasNode = Node<{ node: GraphNode; issues: Issue[] }>;

// 노드 4종이 함께 쓰는 카드. 포트는 core의 NODE_SPECS에서 읽는다.
export function NodeCard({ data, selected }: NodeProps<CanvasNode>) {
  const { node, issues } = data;
  const spec = NODE_SPECS[node.type];
  const outputs = spec.outputs as readonly string[];

  return (
    <div
      // 선택 테두리를 2px로 바꾸면 카드 크기가 변하므로, 1px 테두리 + 그림자 두 겹으로 2px 테두리와 4px 바깥 빛을 그린다.
      className={`min-w-[150px] rounded-lg border bg-raised px-3 py-2.5 ${
        selected
          ? 'border-primary shadow-[0_0_0_1px_var(--primary),0_0_0_5px_var(--primary-ring)]'
          : 'border-border'
      }`}
    >
      {spec.inputs.length > 0 && (
        <Handle type="target" position={Position.Left} id="in" />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.06em] text-primary uppercase">
          {NODE_META[node.type].label}
        </span>
        {issues.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={<span />}
              className="cursor-help rounded-full bg-destructive-soft px-1.5 text-[11px] font-bold text-destructive-text"
            >
              오류 {issues.length}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex-col items-start">
              {issues.map((i) => (
                <div key={i.code + i.message}>{i.message}</div>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* 제목을 바꾸지 않았으면 종류 이름과 같으므로 한 번만 보인다. */}
      {node.title !== NODE_META[node.type].label && (
        <div className="mt-0.5 font-bold">{node.title}</div>
      )}
      <div className="font-mono text-[11px] text-muted-foreground">
        {node.key}
      </div>
      {outputs.map((port, i) => (
        <Handle
          key={port}
          type="source"
          position={Position.Right}
          id={port}
          style={
            outputs.length > 1
              ? { top: `${((i + 1) * 100) / (outputs.length + 1)}%` }
              : undefined
          }
        >
          {PORT_LABEL[port] && (
            <span className="pointer-events-none absolute left-3 -translate-y-1/2 text-[10px] whitespace-nowrap text-muted-foreground">
              {PORT_LABEL[port]}
            </span>
          )}
        </Handle>
      ))}
    </div>
  );
}
