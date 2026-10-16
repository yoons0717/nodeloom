import { describe, expect, it } from 'vitest';
import { createInitialGraph, newNode } from './commands';
import { getGraphIssues } from './graph-issues';

describe('getGraphIssues', () => {
  it('위치만 바뀐 그래프는 다시 검사하지 않고 직전 결과를 쓴다', () => {
    const base = createInitialGraph();
    const http = newNode(base, 'http', { x: 200, y: 0 });
    const graph = { ...base, nodes: [...base.nodes, http] };
    const before = getGraphIssues(graph);

    const moved = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === http.id ? { ...n, position: { x: 300, y: 40 } } : n,
      ),
    };
    expect(getGraphIssues(moved)).toBe(before);
  });

  it('설정이 바뀌면 다시 검사한다', () => {
    const base = createInitialGraph();
    const http = newNode(base, 'http', { x: 200, y: 0 });
    const graph = { ...base, nodes: [...base.nodes, http] };
    const before = getGraphIssues(graph);
    expect(before.byNode.get(http.id)).toBeDefined();

    const fixed = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === http.id ? { ...n, config: { url: 'https://x.test' } } : n,
      ),
    };
    const after = getGraphIssues(fixed);
    expect(after).not.toBe(before);
    expect(after.byNode.get(http.id)).not.toEqual(before.byNode.get(http.id));
  });

  it('선을 새로 이으면 다시 검사한다', () => {
    const base = createInitialGraph();
    const http = newNode(base, 'http', { x: 200, y: 0 });
    const graph = { ...base, nodes: [...base.nodes, http] };
    const before = getGraphIssues(graph);
    expect(before.byNode.get(http.id)).toContainEqual(
      expect.objectContaining({ code: 'unreachable' }),
    );

    const connected = {
      ...graph,
      edges: [
        {
          id: 'e1',
          from: { node: base.nodes[0]!.id, port: 'out' },
          to: { node: http.id, port: 'in' },
        },
      ],
    };
    expect(getGraphIssues(connected).byNode.get(http.id)).not.toContainEqual(
      expect.objectContaining({ code: 'unreachable' }),
    );
  });

  it('참조 키가 바뀌면 다시 검사한다', () => {
    const base = createInitialGraph();
    const http = newNode(base, 'http', { x: 200, y: 0 });
    const graph = { ...base, nodes: [...base.nodes, http] };
    getGraphIssues(graph);

    const renamed = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === http.id ? { ...n, key: base.nodes[0]!.key } : n,
      ),
    };
    expect(getGraphIssues(renamed).byNode.get(http.id)).toContainEqual(
      expect.objectContaining({ code: 'duplicate_key' }),
    );
  });
});
