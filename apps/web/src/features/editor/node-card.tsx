'use client';

import { type GraphNode, type Issue, NODE_SPECS } from '@nodeloom/core';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { NODE_META, PORT_LABEL } from './node-meta';

export type CanvasNode = Node<{ node: GraphNode; issues: Issue[] }>;

// 노드 4종이 함께 쓰는 카드. 포트는 core의 NODE_SPECS에서 읽는다.
export function NodeCard({ data, selected }: NodeProps<CanvasNode>) {
  const { node, issues } = data;
  const spec = NODE_SPECS[node.type];
  const outputs = spec.outputs as readonly string[];

  return (
    <div
      className={`min-w-44 rounded-md border bg-white px-3 py-2 text-sm shadow-sm dark:bg-zinc-900 ${
        selected
          ? 'border-sky-600 ring-2 ring-sky-600/30'
          : 'border-zinc-300 dark:border-zinc-700'
      }`}
    >
      {spec.inputs.length > 0 && (
        <Handle type="target" position={Position.Left} id="in" />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-sky-700 uppercase dark:text-sky-400">
          {NODE_META[node.type].label}
        </span>
        {issues.length > 0 && (
          <span
            className="rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
            title={issues.map((i) => i.message).join('\n')}
          >
            오류 {issues.length}
          </span>
        )}
      </div>
      {/* 제목을 바꾸지 않았으면 종류 이름과 같으므로 한 번만 보인다. */}
      {node.title !== NODE_META[node.type].label && (
        <div className="mt-0.5 font-medium">{node.title}</div>
      )}
      <div className="font-mono text-[11px] text-zinc-500">{node.key}</div>
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
            <span className="pointer-events-none absolute left-3 -translate-y-1/2 text-[10px] text-zinc-500">
              {PORT_LABEL[port]}
            </span>
          )}
        </Handle>
      ))}
    </div>
  );
}
