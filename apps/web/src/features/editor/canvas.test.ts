import type { GraphEdge, Issue } from '@nodeloom/core';
import { describe, expect, it } from 'vitest';
import { toCanvasEdge, toCanvasNode } from './canvas';
import { createInitialGraph } from './commands';

const issue = (message: string): Issue => ({
  code: 'invalid_config',
  message,
  field: 'url',
});

describe('toCanvasNode', () => {
  const node = createInitialGraph().nodes[0]!;
  const size = { width: 136, height: 84 };

  it('그래프 노드·선택·오류·크기가 그대로면 이전 객체를 그대로 돌려준다', () => {
    const first = toCanvasNode(node, [issue('a')], false, size);
    // 오류 배열은 검사할 때마다 새로 만들어지지만 내용이 같으면 같은 오류다.
    expect(toCanvasNode(node, [issue('a')], false, size)).toBe(first);
  });

  it('선택이 바뀌면 새 객체를 만든다', () => {
    const first = toCanvasNode(node, [], false, size);
    const next = toCanvasNode(node, [], true, size);
    expect(next).not.toBe(first);
    expect(next.selected).toBe(true);
  });

  it('오류 내용이 바뀌면 새 객체를 만든다', () => {
    const first = toCanvasNode(node, [issue('a')], false, size);
    const next = toCanvasNode(node, [issue('b')], false, size);
    expect(next).not.toBe(first);
    expect(next.data.issues).toEqual([issue('b')]);
  });

  it('크기가 바뀌면 새 객체를 만든다', () => {
    const first = toCanvasNode(node, [], false, size);
    const next = toCanvasNode(node, [], false, { width: 136, height: 108 });
    expect(next).not.toBe(first);
  });
});

describe('toCanvasEdge', () => {
  const edge: GraphEdge = {
    id: 'e1',
    from: { node: 'a', port: 'out' },
    to: { node: 'b', port: 'in' },
  };

  it('선택이 그대로면 이전 객체를, 바뀌면 새 객체를 돌려준다', () => {
    const first = toCanvasEdge(edge, false);
    expect(toCanvasEdge(edge, false)).toBe(first);
    const next = toCanvasEdge(edge, true);
    expect(next).not.toBe(first);
    expect(next.selected).toBe(true);
  });
});
