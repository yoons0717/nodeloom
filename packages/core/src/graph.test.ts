import { describe, expect, it } from 'vitest';
import { graphSchema, nextNodeKey, NODE_SPECS } from './graph.js';
import { graph, node, rainFlow } from './fixtures.test-util.js';

describe('graphSchema', () => {
  it('예시 흐름을 통과시킨다', () => {
    expect(graphSchema.safeParse(rainFlow()).success).toBe(true);
  });

  it('모르는 노드 종류를 거부한다', () => {
    const g = rainFlow();
    (g.nodes[0] as { type: string }).type = 'shell';
    expect(graphSchema.safeParse(g).success).toBe(false);
  });
});

describe('노드 설정 기본값', () => {
  it('HTTP 설정의 기본값을 채운다', () => {
    expect(NODE_SPECS.http.config.parse({ url: 'https://x.test' })).toEqual({
      method: 'GET',
      url: 'https://x.test',
      query: {},
      headers: {},
      body: '',
      timeoutSec: 10,
      retry: 0,
      continueOnNon2xx: false,
    });
  });

  it('HTTP 타임아웃 30초 초과를 거부한다', () => {
    expect(
      NODE_SPECS.http.config.safeParse({
        url: 'https://x.test',
        timeoutSec: 31,
      }).success,
    ).toBe(false);
  });
});

describe('nextNodeKey', () => {
  it('비어 있는 가장 작은 번호를 쓴다', () => {
    const g = graph([node('http_1', 'http'), node('http_3', 'http')], []);
    expect(nextNodeKey(g, 'http')).toBe('http_2');
    expect(nextNodeKey(g, 'condition')).toBe('condition_1');
  });
});
