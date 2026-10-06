import { describe, expect, it } from 'vitest';
import { addNode, newNode, updateConfig } from './commands';
import { createEditorStore, TYPING_MERGE_MS } from './store';

function setup() {
  const store = createEditorStore();
  const trigger = store.getState().graph.nodes[0]!;
  const http = newNode(store.getState().graph, 'http', { x: 200, y: 0 });
  store.getState().execute(addNode(http), 1_000);
  return { store, trigger, http };
}

const urlOf = (store: ReturnType<typeof createEditorStore>, id: string) =>
  store.getState().graph.nodes.find((n) => n.id === id)?.config.url;

describe('createEditorStore', () => {
  it('에디터마다 서로 다른 스토어를 만든다', () => {
    const a = createEditorStore();
    const b = createEditorStore();
    a.getState().execute(
      addNode(newNode(a.getState().graph, 'http', { x: 0, y: 0 })),
    );
    expect(a.getState().graph.nodes).toHaveLength(2);
    expect(b.getState().graph.nodes).toHaveLength(1);
  });
});

describe('undo, redo', () => {
  it('Undo는 마지막 커맨드를 되돌리고 Redo는 다시 실행한다', () => {
    const { store } = setup();
    store.getState().undo();
    expect(store.getState().graph.nodes).toHaveLength(1);
    store.getState().redo();
    expect(store.getState().graph.nodes).toHaveLength(2);
  });

  it('Undo 뒤에 새 커맨드를 실행하면 Redo 기록이 사라진다', () => {
    const { store } = setup();
    store.getState().undo();
    store
      .getState()
      .execute(
        addNode(newNode(store.getState().graph, 'condition', { x: 0, y: 0 })),
        5_000,
      );
    expect(store.getState().future).toEqual([]);
  });

  it('되돌릴 것이 없으면 아무것도 하지 않는다', () => {
    const store = createEditorStore();
    const before = store.getState().graph;
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().graph).toBe(before);
  });
});

describe('execute', () => {
  it(`같은 칸을 ${TYPING_MERGE_MS}ms 안에 이어서 입력하면 Undo 한 번에 모두 되돌아간다`, () => {
    const { store, http } = setup();
    const type = (value: string, at: number) =>
      store
        .getState()
        .execute(
          updateConfig(store.getState().graph, http.id, 'url', value),
          at,
        );
    type('h', 2_000);
    type('ht', 2_200);
    type('htt', 2_400);
    expect(store.getState().past).toHaveLength(2);
    store.getState().undo();
    expect(urlOf(store, http.id)).toBeUndefined();
  });

  it('간격이 벌어지면 따로 기록한다', () => {
    const { store, http } = setup();
    store
      .getState()
      .execute(
        updateConfig(store.getState().graph, http.id, 'url', 'a'),
        2_000,
      );
    store
      .getState()
      .execute(
        updateConfig(store.getState().graph, http.id, 'url', 'ab'),
        2_000 + TYPING_MERGE_MS,
      );
    store.getState().undo();
    expect(urlOf(store, http.id)).toBe('a');
  });

  it('다른 칸의 입력은 합치지 않는다', () => {
    const { store, http } = setup();
    store
      .getState()
      .execute(
        updateConfig(store.getState().graph, http.id, 'url', 'a'),
        2_000,
      );
    store
      .getState()
      .execute(
        updateConfig(store.getState().graph, http.id, 'method', 'POST'),
        2_100,
      );
    expect(store.getState().past).toHaveLength(3);
  });
});

describe('beginDrag, dragTo, endDrag', () => {
  it('드래그 중에는 기록하지 않고, 놓을 때 이동 하나로 기록한다', () => {
    const { store, http } = setup();
    store.getState().beginDrag([http.id]);
    for (const x of [210, 220, 230])
      store.getState().dragTo({ [http.id]: { x, y: 0 } });
    expect(store.getState().past).toHaveLength(1);
    store.getState().endDrag();
    expect(store.getState().past).toHaveLength(2);
    store.getState().undo();
    expect(store.getState().graph.nodes[1]!.position).toEqual({ x: 200, y: 0 });
  });

  it('제자리에 놓으면 기록하지 않는다', () => {
    const { store, http } = setup();
    store.getState().beginDrag([http.id]);
    store.getState().endDrag();
    expect(store.getState().past).toHaveLength(1);
  });
});

describe('tryConnect', () => {
  it('core 규칙을 통과한 연결만 실행한다', () => {
    const { store, trigger, http } = setup();
    const edge = {
      id: 'e1',
      from: { node: trigger.id, port: 'out' },
      to: { node: http.id, port: 'in' },
    };
    expect(store.getState().tryConnect(edge)).toEqual({ ok: true });
    expect(store.getState().tryConnect({ ...edge, id: 'e2' })).toMatchObject({
      ok: false,
      code: 'duplicate_edge',
    });
    expect(store.getState().graph.edges).toHaveLength(1);
  });

  it('순환을 만드는 연결은 거부하고 기록하지 않는다', () => {
    const { store, trigger, http } = setup();
    store.getState().tryConnect({
      id: 'e1',
      from: { node: trigger.id, port: 'out' },
      to: { node: http.id, port: 'in' },
    });
    const tf = newNode(store.getState().graph, 'transform', { x: 400, y: 0 });
    store.getState().execute(addNode(tf), 9_000);
    store.getState().tryConnect({
      id: 'e2',
      from: { node: http.id, port: 'out' },
      to: { node: tf.id, port: 'in' },
    });
    const pastBefore = store.getState().past.length;
    // transform은 출력 포트 out, http는 입력 포트 in: tf → http 를 이으면 http → tf → http 순환
    expect(
      store.getState().tryConnect({
        id: 'e3',
        from: { node: tf.id, port: 'out' },
        to: { node: http.id, port: 'in' },
      }),
    ).toMatchObject({ ok: false, code: 'cycle' });
    expect(store.getState().past).toHaveLength(pastBefore);
  });
});

describe('deleteSelection', () => {
  it('선택한 노드와 연결을 한 번에 지우고, Undo 한 번에 모두 되돌린다', () => {
    const { store, trigger, http } = setup();
    store.getState().tryConnect({
      id: 'e1',
      from: { node: trigger.id, port: 'out' },
      to: { node: http.id, port: 'in' },
    });
    store.getState().setSelection({ nodeIds: [http.id], edgeIds: ['e1'] });
    store.getState().deleteSelection();
    expect(store.getState().graph.nodes).toHaveLength(1);
    expect(store.getState().graph.edges).toHaveLength(0);
    expect(store.getState().selection).toEqual({ nodeIds: [], edgeIds: [] });
    store.getState().undo();
    expect(store.getState().graph.nodes).toHaveLength(2);
    expect(store.getState().graph.edges).toHaveLength(1);
  });

  it('선택한 것이 없으면 기록하지 않는다', () => {
    const { store } = setup();
    store.getState().deleteSelection();
    expect(store.getState().past).toHaveLength(1);
  });
});

describe('updateSelection', () => {
  it('같은 순간에 노드와 연결 선택이 따로 바뀌어도 서로 덮어쓰지 않는다', () => {
    const { store, http } = setup();
    store.getState().setSelection({ nodeIds: [http.id], edgeIds: [] });
    // 연결선을 클릭하면 React Flow는 노드 선택 해제와 연결 선택을 따로 알린다.
    store.getState().updateSelection((s) => ({ ...s, nodeIds: [] }));
    store.getState().updateSelection((s) => ({ ...s, edgeIds: ['e1'] }));
    expect(store.getState().selection).toEqual({
      nodeIds: [],
      edgeIds: ['e1'],
    });
  });
});
