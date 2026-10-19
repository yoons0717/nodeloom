import { describe, expect, it } from 'vitest';
import type { Graph } from '@nodeloom/core';
import {
  addNode,
  connect,
  createInitialGraph,
  deleteElements,
  moveNodes,
  newNode,
  renameNode,
  updateConfig,
} from './commands';

// trigger → http → transform
function sample(): Graph {
  let g = createInitialGraph();
  const http = newNode(g, 'http', { x: 200, y: 0 });
  g = addNode(http).apply(g);
  const tf = newNode(g, 'transform', { x: 400, y: 0 });
  g = addNode(tf).apply(g);
  const [trigger] = g.nodes;
  g = connect({
    id: 'e1',
    from: { node: trigger!.id, port: 'out' },
    to: { node: http.id, port: 'in' },
  }).apply(g);
  g = connect({
    id: 'e2',
    from: { node: http.id, port: 'out' },
    to: { node: tf.id, port: 'in' },
  }).apply(g);
  return g;
}

describe('Command.revert', () => {
  const cases: [string, (g: Graph) => ReturnType<typeof addNode>][] = [
    ['노드 추가', (g) => addNode(newNode(g, 'condition', { x: 9, y: 9 }))],
    [
      '노드 이동',
      (g) =>
        moveNodes([
          {
            id: g.nodes[1]!.id,
            from: g.nodes[1]!.position,
            to: { x: 5, y: 5 },
          },
        ]),
    ],
    [
      '연결',
      (g) =>
        connect({
          id: 'e3',
          from: { node: g.nodes[0]!.id, port: 'out' },
          to: { node: g.nodes[2]!.id, port: 'in' },
        }),
    ],
    ['연결 삭제', (g) => deleteElements(g, [], ['e1'])],
    ['노드 삭제', (g) => deleteElements(g, [g.nodes[1]!.id], [])],
    [
      '설정 변경(새 칸)',
      (g) => updateConfig(g, g.nodes[1]!.id, 'url', 'https://x'),
    ],
    ['제목 변경', (g) => renameNode(g, g.nodes[1]!.id, 'title', '날씨 조회')],
    ['참조 키 변경', (g) => renameNode(g, g.nodes[1]!.id, 'key', 'weather_1')],
  ];

  it.each(cases)('%s는 되돌리면 원래 그래프와 같아진다', (_, make) => {
    const before = sample();
    const command = make(before);
    const after = command.apply(before);
    expect(after).not.toEqual(before);
    expect(command.revert(after)).toEqual(before);
  });
});

describe('deleteElements', () => {
  it('노드를 지우면 붙어 있던 연결도 함께 지운다', () => {
    const g = sample();
    const after = deleteElements(g, [g.nodes[1]!.id], []).apply(g);
    expect(after.nodes).toHaveLength(2);
    expect(after.edges).toEqual([]);
  });

  it('되돌리면 노드와 연결이 원래 순서대로 돌아온다', () => {
    const g = sample();
    const command = deleteElements(g, [g.nodes[1]!.id], []);
    const restored = command.revert(command.apply(g));
    expect(restored.nodes.map((n) => n.id)).toEqual(g.nodes.map((n) => n.id));
    expect(restored.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('updateConfig', () => {
  it('원래 없던 칸을 되돌리면 칸 자체를 없앤다', () => {
    const g = sample();
    const command = updateConfig(g, g.nodes[1]!.id, 'url', 'https://x');
    expect('url' in command.revert(command.apply(g)).nodes[1]!.config).toBe(
      false,
    );
  });
});
