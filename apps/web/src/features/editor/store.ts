import {
  canConnect,
  type ConnectResult,
  type Graph,
  type GraphEdge,
  type GraphNode,
} from '@nodeloom/core';
import { createStore } from 'zustand/vanilla';
import {
  type Command,
  connect,
  createInitialGraph,
  mergeCommands,
  moveNodes,
  type NodeMove,
} from './commands';

// 같은 칸을 이 시간 안에 이어서 입력하면 Undo 한 번에 되돌아간다(M2 작은 결정 ⑤).
export const TYPING_MERGE_MS = 500;

type HistoryEntry = { command: Command; at: number };

export type EditorState = {
  graph: Graph;
  past: HistoryEntry[];
  future: HistoryEntry[];
  dragStart: Map<string, GraphNode['position']> | null;
  execute: (command: Command, now?: number) => void;
  undo: () => void;
  redo: () => void;
  tryConnect: (edge: GraphEdge) => ConnectResult;
  beginDrag: (nodeIds: string[]) => void;
  dragTo: (positions: Record<string, GraphNode['position']>) => void;
  endDrag: () => void;
};

// 에디터마다 새 스토어를 만든다. 모듈 전역 스토어는 서버 렌더링 때 요청끼리 공유될 수 있다(DECISIONS B-12).
// 그래프의 원본은 이 스토어 하나에만 있고, React Flow는 여기서 만든 값만 받는다(DECISIONS 5-1).
export function createEditorStore(initial: Graph = createInitialGraph()) {
  return createStore<EditorState>()((set, get) => ({
    graph: initial,
    past: [],
    future: [],
    dragStart: null,

    execute: (command, now = Date.now()) => {
      const { graph, past } = get();
      const top = past.at(-1);
      const merge =
        command.mergeKey !== undefined &&
        top?.command.mergeKey === command.mergeKey &&
        now - top.at < TYPING_MERGE_MS;
      set({
        graph: command.apply(graph),
        past: merge
          ? [
              ...past.slice(0, -1),
              { command: mergeCommands(top.command, command), at: now },
            ]
          : [...past, { command, at: now }],
        future: [],
      });
    },

    undo: () => {
      const { graph, past, future } = get();
      const top = past.at(-1);
      if (!top) return;
      set({
        graph: top.command.revert(graph),
        past: past.slice(0, -1),
        future: [top, ...future],
      });
    },

    redo: () => {
      const { graph, past, future } = get();
      const [next, ...rest] = future;
      if (!next) return;
      // 다시 실행한 커맨드는 다음 입력과 합쳐지지 않도록 시간을 0으로 기록한다.
      set({
        graph: next.command.apply(graph),
        past: [...past, { command: next.command, at: 0 }],
        future: rest,
      });
    },

    tryConnect: (edge) => {
      const result = canConnect(get().graph, edge.from, edge.to);
      if (result.ok) get().execute(connect(edge));
      return result;
    },

    // 드래그 중에는 위치만 바꾸고 기록하지 않는다. 놓을 때 시작·끝 위치로 이동 커맨드 하나를 남긴다(DECISIONS 4-4).
    beginDrag: (nodeIds) => {
      const ids = new Set(nodeIds);
      set({
        dragStart: new Map(
          get()
            .graph.nodes.filter((n) => ids.has(n.id))
            .map((n) => [n.id, n.position]),
        ),
      });
    },

    dragTo: (positions) => {
      const { graph } = get();
      set({
        graph: {
          ...graph,
          nodes: graph.nodes.map((n) =>
            positions[n.id] ? { ...n, position: positions[n.id]! } : n,
          ),
        },
      });
    },

    endDrag: () => {
      const { graph, dragStart, past } = get();
      if (!dragStart) return;
      const moves: NodeMove[] = graph.nodes.flatMap((n) => {
        const from = dragStart.get(n.id);
        return from && (from.x !== n.position.x || from.y !== n.position.y)
          ? [{ id: n.id, from, to: n.position }]
          : [];
      });
      // 위치는 이미 반영돼 있으므로 기록만 남긴다.
      set({
        dragStart: null,
        ...(moves.length
          ? {
              past: [...past, { command: moveNodes(moves), at: 0 }],
              future: [],
            }
          : {}),
      });
    },
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;
