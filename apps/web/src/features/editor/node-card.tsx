'use client';

import { type GraphNode, type Issue, NODE_SPECS } from '@nodeloom/core';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { Profiler } from 'react';
import { cn } from '@/lib/utils';
import { formatMs } from '@/features/runs/format';
import { onNodeRender } from './bench';
import { NodeGlyph } from './node-glyph';
import { NODE_META, PORT_LABEL, summarizeNode } from './node-meta';

export type NodeRunView = {
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  // Condition이 고른 포트
  port?: string;
  durationMs?: number;
};

// run은 실행 상세 화면에서만 넘긴다. 에디터에서는 없다.
export type CanvasNode = Node<{
  node: GraphNode;
  issues: Issue[];
  run?: NodeRunView;
}>;

// 카드 크기는 고정이다(M6 작은 결정 ⑦). 포트 위치도 이 높이에 맞춘다.
const HEIGHT = { default: 84, condition: 108 };
// Condition의 참·거짓 포트는 카드 안 라벨 줄의 가운데에 둔다(데모 기준).
const CONDITION_PORT_TOP = { true: 63, false: 85 };

// 노드 4종이 함께 쓰는 카드. 1줄 종류와 상태, 2줄 제목, 3줄 설정 요약(Condition은 참·거짓 라벨).
export function NodeCard({ data, selected }: NodeProps<CanvasNode>) {
  const { node, issues, run } = data;
  const spec = NODE_SPECS[node.type];
  const outputs = spec.outputs as readonly string[];
  const isCondition = node.type === 'condition';
  const height = isCondition ? HEIGHT.condition : HEIGHT.default;
  const firstIssue = issues[0];

  // 상태마다 테두리와 오른쪽 위 표시. 오류(편집 중 검사)가 실행 상태보다 먼저다.
  const frame = selected
    ? 'border-2 border-accent px-[11px] py-[9px] shadow-[0_0_0_4px_var(--accent-ring)]'
    : firstIssue || run?.status === 'FAILED'
      ? 'border-danger'
      : run?.status === 'RUNNING'
        ? 'border-accent'
        : run?.status === 'SKIPPED'
          ? 'border-dashed bg-surface opacity-60'
          : 'border-border hover:border-border-control hover:bg-raised-hover';

  return (
    // 벤치 모드에서 노드 카드가 몇 번 다시 그려지는지 센다(DECISIONS 5-3). 일반 프로덕션 빌드에서는 아무 일도 하지 않는다.
    <Profiler id="node" onRender={onNodeRender}>
      <div
        data-key={node.key}
        style={{ height }}
        className={cn(
          'flex w-[136px] flex-col gap-1 rounded-lg border bg-raised px-3 py-2.5',
          frame,
        )}
      >
        {spec.inputs.length > 0 && (
          <Handle type="target" position={Position.Left} id="in" />
        )}
        <div className="flex h-[18px] items-center gap-1.5">
          <NodeGlyph type={node.type} />
          <span className="min-w-0 truncate text-caption text-muted-foreground">
            {NODE_META[node.type].label}
          </span>
          {/* 상태는 꺾이지 않고, 자리가 모자라면 종류 이름이 줄어든다. */}
          <span className="ml-auto shrink-0 text-caption font-bold whitespace-nowrap">
            {firstIssue ? (
              <span
                title={issues.map((i) => i.message).join('\n')}
                className="rounded-full bg-danger-soft px-1.5 text-danger-text"
              >
                ! {issues.length}
              </span>
            ) : run?.status === 'RUNNING' ? (
              <span className="text-accent">● 실행 중</span>
            ) : run?.status === 'SUCCESS' ? (
              <span className="whitespace-nowrap text-success">
                ✓ {run.durationMs !== undefined && formatMs(run.durationMs)}
              </span>
            ) : run?.status === 'FAILED' ? (
              <span className="text-danger-text">! 실패</span>
            ) : run?.status === 'SKIPPED' ? (
              <span className="font-normal text-muted-foreground">
                – 건너뜀
              </span>
            ) : null}
          </span>
        </div>
        <div className="truncate text-body-sm font-bold">{node.title}</div>
        {isCondition ? (
          <div className="flex flex-col items-end gap-1.5 text-caption">
            {(['true', 'false'] as const).map((port) => (
              <span
                key={port}
                className={cn(
                  // 실행 상세에서는 고른 쪽을 표시하고 고르지 않은 쪽은 흐리게(데모).
                  !run?.port
                    ? 'text-label'
                    : run.port === port
                      ? 'font-bold text-accent'
                      : 'text-disabled',
                )}
              >
                {PORT_LABEL[port]}
                {run?.port === port && ' ●'}
              </span>
            ))}
          </div>
        ) : run?.status === 'RUNNING' ? (
          // 얼마나 진행됐는지는 알 수 없어서 움직이는 막대로 실행 중임만 보여 준다.
          <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border">
            <div className="h-full w-1/2 animate-[run-bar_1.2s_ease-in-out_infinite] bg-accent" />
          </div>
        ) : (
          <div
            className={cn(
              'truncate font-mono text-caption',
              firstIssue ? 'text-danger-text' : 'text-muted-foreground',
            )}
          >
            {firstIssue ? firstIssue.message : summarizeNode(node)}
          </div>
        )}
        {outputs.map((port) => (
          <Handle
            key={port}
            type="source"
            position={Position.Right}
            id={port}
            style={
              isCondition
                ? {
                    top: CONDITION_PORT_TOP[
                      port as keyof typeof CONDITION_PORT_TOP
                    ],
                  }
                : undefined
            }
          />
        ))}
      </div>
    </Profiler>
  );
}
