import { describe, expect, it } from 'vitest';
import { topoSort } from './topo.js';
import { edge, graph, node, rainFlow } from './fixtures.test-util.js';

// 병렬 수집 후 합류: trigger → (weather, dust) → merge → notify
function diamond() {
  return graph(
    [
      node('trigger_1', 'trigger'),
      node('weather_1', 'http', { url: 'https://w' }),
      node('dust_1', 'http', { url: 'https://d' }),
      node('merge_1', 'transform', { expression: '1' }),
      node('notify_1', 'http', { url: 'https://n' }),
    ],
    [
      edge('trigger_1', 'weather_1'),
      edge('trigger_1', 'dust_1'),
      edge('weather_1', 'merge_1'),
      edge('dust_1', 'merge_1'),
      edge('merge_1', 'notify_1'),
    ],
  );
}

const before = (order: string[], a: string, b: string) =>
  order.indexOf(a) < order.indexOf(b);

describe('topoSort', () => {
  it('일직선 흐름을 순서대로 세운다', () => {
    expect(topoSort(rainFlow())).toEqual({
      ok: true,
      order: ['trigger_1', 'weather_1', 'cond_1', 'msg_1', 'notify_1'],
    });
  });

  it('갈라졌다 합쳐지는 흐름에서도 부모가 항상 자식보다 앞선다', () => {
    const result = topoSort(diamond());
    if (!result.ok) throw new Error('expected ok');
    for (const e of diamond().edges)
      expect(before(result.order, e.from.node, e.to.node)).toBe(true);
  });

  it('순환 뒤에 매달린 노드는 빼고 순환에 걸린 노드만 돌려준다', () => {
    const g = diamond();
    g.edges.push(edge('merge_1', 'weather_1'));
    expect(topoSort(g)).toEqual({ ok: false, cycle: ['weather_1', 'merge_1'] });
  });

  it('자기 연결도 순환으로 본다', () => {
    const g = rainFlow();
    g.edges.push(edge('msg_1', 'msg_1'));
    expect(topoSort(g)).toEqual({ ok: false, cycle: ['msg_1'] });
  });
});
