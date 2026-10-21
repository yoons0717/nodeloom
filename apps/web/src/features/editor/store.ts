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
  deleteElements,
  createInitialGraph,
  mergeCommands,
  moveNodes,
  type NodeMove,
} from './commands';

// 같은 칸을 이 시간 안에 이어서 입력하면 Undo 한 번에 되돌아간다.
export const TYPING_MERGE_MS = 500;

export type Selection = { nodeIds: string[]; edgeIds: string[] };

type HistoryEntry = { command: Command; at: number };

export type EditorState = {
  graph: Graph;
  past: HistoryEntry[];
  future: HistoryEntry[];
  dragStart: Map<string, GraphNode['position']> | null;
  // 선택은 그래프 변경이 아니므로 Undo 기록에 남기지 않는다.
  selection: Selection;
  setSelection: (selection: Selection) => void;
  // 현재 선택을 기준으로 바꾼다. 같은 순간에 여러 선택 알림이 와도 앞의 변경을 덮어쓰지 않는다.
  updateSelection: (update: (current: Selection) => Selection) => void;
  deleteSelection: () => void;
  execute: (command: Command, now?: number) => void;
  undo: () => void;
  redo: () => void;
  tryConnect: (edge: GraphEdge) => ConnectResult;
  beginDrag: (nodeIds: string[]) => void;
  dragTo: (positions: Record<string, GraphNode['position']>) => void;
  endDrag: () => void;
};

// 에디터마다 새 스토어를 만든다. 모듈 전역 스토어는 서버 렌더링 때 요청끼리 공유될 수 있다.
// 그래프의 원본은 이 스토어 하나에만 있고, React Flow는 여기서 만든 값만 받는다.
export function createEditorStore(initial: Graph = createInitialGraph()) {
  return createStore<EditorState>()((set, get) => ({
    graph: initial,
    past: [],
    future: [],
    dragStart: null,
    selection: { nodeIds: [], edgeIds: [] },

    // 내용이 같으면 그대로 둔다. React Flow는 선택을 넘겨받을 때마다 선택 변경 이벤트를 다시 보내므로,
    // 매번 새 객체를 저장하면 서로 갱신을 주고받으며 멈추지 않는다.
    setSelection: (selection) => {
      const current = get().selection;
      const same = (a: string[], b: string[]) =>
        a.length === b.length && a.every((id, i) => id === b[i]);
      if (
        same(current.nodeIds, selection.nodeIds) &&
        same(current.edgeIds, selection.edgeIds)
      )
        return;
      set({ selection });
    },

    updateSelection: (update) => get().setSelection(update(get().selection)),

    deleteSelection: () => {
      const { graph, selection, execute } = get();
      if (!selection.nodeIds.length && !selection.edgeIds.length) return;
      execute(deleteElements(graph, selection.nodeIds, selection.edgeIds));
      set({ selection: { nodeIds: [], edgeIds: [] } });
    },

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

    // 드래그 중에는 위치만 바꾸고 기록하지 않는다. 놓을 때 시작·끝 위치로 이동 커맨드 하나를 남긴다.
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
