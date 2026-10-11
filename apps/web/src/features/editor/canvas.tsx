'use client';

import {
  canConnect,
  type Graph,
  type GraphEdge,
  type NodeType,
  type PortRef,
} from '@nodeloom/core';
import {
  Background,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
  type NodeDimensionChange,
  ReactFlow,
  useConnection,
  useReactFlow,
  ViewportPortal,
} from '@xyflow/react';
import { type DragEvent, type ReactNode, useCallback, useState } from 'react';
import { CanvasControls } from './canvas-controls';
import { addNode, newNode } from './commands';
import { getGraphIssues } from './graph-issues';
import { type CanvasNode, NodeCard } from './node-card';
import { DRAG_MIME } from './node-meta';
import { useEditorStore } from './store-context';

const nodeTypes = {
  trigger: NodeCard,
  http: NodeCard,
  transform: NodeCard,
  condition: NodeCard,
};
const GRID: [number, number] = [16, 16];

// React Flow의 연결 정보(source/target)를 core의 포트 표기(from/to)로 바꾼다.
function toPorts(c: {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}) {
  const from: PortRef = { node: c.source, port: c.sourceHandle ?? 'out' };
  const to: PortRef = { node: c.target, port: c.targetHandle ?? 'in' };
  return { from, to };
}

// 선택 알림(select)을 반영한 새 id 목록. 선택 알림이 없으면 그대로 돌려준다.
function applySelect(
  current: string[],
  changes: (NodeChange<CanvasNode> | EdgeChange)[],
): string[] {
  const selects = changes.filter((c) => c.type === 'select');
  if (!selects.length) return current;
  const ids = new Set(current);
  for (const c of selects) {
    if (c.selected) ids.add(c.id);
    else ids.delete(c.id);
  }
  return [...ids];
}

// children: 캔버스 위에 겹쳐 그릴 것(성능 HUD 등).
export function Canvas({ children }: { children?: ReactNode }) {
  const graph = useEditorStore((s) => s.graph);
  const selection = useEditorStore((s) => s.selection);
  const execute = useEditorStore((s) => s.execute);
  const tryConnect = useEditorStore((s) => s.tryConnect);
  const beginDrag = useEditorStore((s) => s.beginDrag);
  const dragTo = useEditorStore((s) => s.dragTo);
  const endDrag = useEditorStore((s) => s.endDrag);
  const updateSelection = useEditorStore((s) => s.updateSelection);
  const { screenToFlowPosition } = useReactFlow();

  // React Flow가 잰 노드 크기. 그래프가 아니라 화면 정보라서 스토어에 넣지 않는다.
  const [measured, setMeasured] = useState<
    Record<string, NodeDimensionChange['dimensions']>
  >({});

  const issues = getGraphIssues(graph).byNode;

  // 원본은 스토어의 그래프 하나. React Flow는 여기서 만든 값만 받는다(제어 모드, DECISIONS 5-1).
  const nodes: CanvasNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { node: n, issues: issues.get(n.id) ?? [] },
    selected: selection.nodeIds.includes(n.id),
    measured: measured[n.id],
  }));
  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.from.node,
    sourceHandle: e.from.port,
    target: e.to.node,
    targetHandle: e.to.port,
    selected: selection.edgeIds.includes(e.id),
  }));

  // 선택도 제어 모드다. React Flow가 보낸 선택 알림을 스토어의 선택에 반영해야 화면에서 선택된다.
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const positions: Record<string, { x: number; y: number }> = {};
      for (const c of changes) {
        if (c.type === 'position' && c.position) positions[c.id] = c.position;
        if (c.type === 'dimensions' && c.dimensions) {
          const { id, dimensions } = c;
          setMeasured((m) => ({ ...m, [id]: dimensions }));
        }
      }
      if (Object.keys(positions).length) dragTo(positions);
      updateSelection((s) => ({
        ...s,
        nodeIds: applySelect(s.nodeIds, changes),
      }));
    },
    [dragTo, updateSelection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      updateSelection((s) => ({
        ...s,
        edgeIds: applySelect(s.edgeIds, changes),
      }));
    },
    [updateSelection],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (c) => {
      const { from, to } = toPorts(c);
      return canConnect(graph, from, to).ok;
    },
    [graph],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const edge: GraphEdge = { id: crypto.randomUUID(), ...toPorts(c) };
      tryConnect(edge);
    },
    [tryConnect],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DRAG_MIME) as NodeType | '';
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      execute(addNode(newNode(graph, type, position)));
    },
    [execute, graph, screenToFlowPosition],
  );

  return (
    <div
      className="relative min-w-0 flex-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <ReactFlow<CanvasNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={(_, __, dragged) =>
          beginDrag(dragged.map((n) => n.id))
        }
        onNodeDragStop={() => endDrag()}
        onEdgesChange={onEdgesChange}
        isValidConnection={isValidConnection}
        onConnect={onConnect}
        deleteKeyCode={null}
        snapToGrid
        snapGrid={GRID}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <Background gap={GRID[0]} />
        <CanvasControls />
        <ConnectionFeedback graph={graph} />
        {children}
      </ReactFlow>
    </div>
  );
}

// 선을 끄는 동안 연결할 수 없는 포트 위에 있으면 포인터 옆에 거부 사유를 보여 준다.
function ConnectionFeedback({ graph }: { graph: Graph }) {
  const connection = useConnection();
  if (
    !connection.inProgress ||
    connection.isValid !== false ||
    !connection.toHandle
  )
    return null;

  const { fromHandle, toHandle } = connection;
  // 입력 포트에서 끌기 시작했다면 방향을 뒤집어 출력 → 입력으로 판정한다.
  const [source, target] =
    fromHandle.type === 'source'
      ? [fromHandle, toHandle]
      : [toHandle, fromHandle];
  const { from, to } = toPorts({
    source: source.nodeId,
    sourceHandle: source.id ?? null,
    target: target.nodeId,
    targetHandle: target.id ?? null,
  });
  const result = canConnect(graph, from, to);
  if (result.ok) return null;

  return (
    <ViewportPortal>
      <div
        role="alert"
        className="pointer-events-none absolute z-[2000] rounded-md bg-danger-strong px-2 py-1 text-xs whitespace-nowrap text-foreground"
        style={{
          transform: `translate(${connection.to.x + 12}px, ${connection.to.y + 12}px)`,
        }}
      >
        {result.message}
      </div>
    </ViewportPortal>
  );
}
