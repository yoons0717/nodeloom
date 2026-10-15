import { describe, expect, it } from 'vitest';
import { buildInput, decideNode, type NodeRunState } from './flow.js';
import { edge, graph, node } from './fixtures.test-util.js';

const ok = (port?: string): NodeRunState => ({ status: 'success', port });
const st = (status: NodeRunState['status']): NodeRunState => ({ status });

// trigger → cond ─true→ a ─┐
//                └false→ b ─┴→ join      (if/else 후 합류)
// trigger → w, d → merge                (병렬 수집)
const g = graph(
  [
    node('trigger_1', 'trigger'),
    node('cond_1', 'condition', { expression: 'x' }),
    node('a_1', 'transform', { expression: '1' }),
    node('b_1', 'transform', { expression: '2' }),
    node('join_1', 'transform', { expression: '3' }),
    node('w_1', 'http', { url: 'https://w' }),
    node('d_1', 'http', { url: 'https://d' }),
    node('merge_1', 'transform', { expression: '4' }),
  ],
  [
    edge('trigger_1', 'cond_1'),
    edge('cond_1', 'a_1', 'true'),
    edge('cond_1', 'b_1', 'false'),
    edge('a_1', 'join_1'),
    edge('b_1', 'join_1'),
    edge('trigger_1', 'w_1'),
    edge('trigger_1', 'd_1'),
    edge('w_1', 'merge_1'),
    edge('d_1', 'merge_1'),
  ],
);

describe('decideNode', () => {
  it('부모가 없는 노드는 실행한다', () => {
    expect(decideNode('trigger_1', g, {})).toBe('run');
  });

  it('부모가 끝나지 않았으면 기다린다', () => {
    expect(decideNode('cond_1', g, { trigger_1: st('running') })).toBe('wait');
  });

  it('Condition이 고른 쪽은 실행하고 다른 쪽은 건너뛴다', () => {
    const states = { cond_1: ok('true') };
    expect(decideNode('a_1', g, states)).toBe('run');
    expect(decideNode('b_1', g, states)).toBe('skip');
  });

  it('if/else 합류는 한쪽이 성공하고 다른 쪽이 건너뛰어졌으면 실행한다', () => {
    expect(decideNode('join_1', g, { a_1: ok(), b_1: st('skipped') })).toBe(
      'run',
    );
  });

  it('부모가 모두 건너뛰어졌으면 합류 노드도 건너뛴다', () => {
    expect(
      decideNode('join_1', g, { a_1: st('skipped'), b_1: st('skipped') }),
    ).toBe('skip');
  });

  it('합류 노드는 부모가 모두 끝날 때까지 기다린다', () => {
    expect(decideNode('merge_1', g, { w_1: ok(), d_1: st('pending') })).toBe(
      'wait',
    );
  });

  it('실패한 부모가 있으면 다른 부모가 성공했어도 건너뛴다', () => {
    expect(decideNode('merge_1', g, { w_1: ok(), d_1: st('failed') })).toBe(
      'skip',
    );
    expect(decideNode('cond_1', g, { trigger_1: st('failed') })).toBe('skip');
  });
});

describe('buildInput', () => {
  it('부모가 하나면 그 출력을 그대로 넘긴다', () => {
    expect(
      buildInput(
        'cond_1',
        g,
        { trigger_1: ok() },
        { trigger_1: { city: 'Seoul' } },
      ),
    ).toEqual({ city: 'Seoul' });
  });

  it('부모가 여럿이면 참조 키로 묶는다', () => {
    const states = { w_1: ok(), d_1: ok() };
    expect(
      buildInput('merge_1', g, states, {
        w_1: { rain: 72 },
        d_1: { pm10: 30 },
      }),
    ).toEqual({
      w_1: { rain: 72 },
      d_1: { pm10: 30 },
    });
  });

  it('노드 id가 아니라 참조 키로 묶는다', () => {
    const renamed = graph(
      [
        { ...node('w_1', 'http', { url: 'https://w' }), id: 'n1' },
        { ...node('d_1', 'http', { url: 'https://d' }), id: 'n2' },
        { ...node('merge_1', 'transform', { expression: '1' }), id: 'n3' },
      ],
      [edge('n1', 'n3'), edge('n2', 'n3')],
    );
    expect(
      buildInput('n3', renamed, { n1: ok(), n2: ok() }, { n1: 'W', n2: 'D' }),
    ).toEqual({ w_1: 'W', d_1: 'D' });
  });

  it('if/else 뒤에는 성공한 쪽만 담는다', () => {
    expect(
      buildInput(
        'join_1',
        g,
        { a_1: ok(), b_1: st('skipped') },
        { a_1: 'A', b_1: 'B' },
      ),
    ).toEqual({ a_1: 'A' });
  });

  it('실패한 부모의 출력은 넘겨받아도 담지 않는다', () => {
    expect(
      buildInput(
        'merge_1',
        g,
        { w_1: ok(), d_1: st('failed') },
        { w_1: 'W', d_1: 'D' },
      ),
    ).toEqual({ w_1: 'W' });
  });

  it('부모가 하나여도 선택되지 않은 갈래면 입력이 없다', () => {
    expect(
      buildInput('b_1', g, { cond_1: ok('true') }, { cond_1: 'C' }),
    ).toBeUndefined();
  });

  it('부모가 없는 노드는 undefined를 돌려준다', () => {
    expect(buildInput('trigger_1', g, {}, {})).toBeUndefined();
  });
});
