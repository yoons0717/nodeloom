import { describe, expect, it } from 'vitest';
import { graphSchema, nextNodeKey } from './graph.js';
import { NODE_SPECS } from './node-specs.js';
import { graph, node, rainFlow } from './fixtures.test-util.js';

describe('graphSchema', () => {
  it('예시 흐름을 통과시킨다', () => {
    expect(graphSchema.safeParse(rainFlow()).success).toBe(true);
  });

  it('노드 위치가 숫자가 아니면 거부한다', () => {
    const g = rainFlow();
    (g.nodes[0] as { position: unknown }).position = { x: '0', y: 0 };
    expect(graphSchema.safeParse(g).success).toBe(false);
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

  const accepts = (config: Record<string, unknown>) =>
    NODE_SPECS.http.config.safeParse({ url: 'https://x.test', ...config })
      .success;

  it('HTTP 타임아웃은 1~30초 정수만 받는다', () => {
    expect(accepts({ timeoutSec: 1 })).toBe(true);
    expect(accepts({ timeoutSec: 30 })).toBe(true);
    expect(accepts({ timeoutSec: 0 })).toBe(false);
    expect(accepts({ timeoutSec: 31 })).toBe(false);
    expect(accepts({ timeoutSec: 1.5 })).toBe(false);
  });

  it('HTTP 재시도는 0~5회 정수만 받는다', () => {
    expect(accepts({ retry: 0 })).toBe(true);
    expect(accepts({ retry: 5 })).toBe(true);
    expect(accepts({ retry: -1 })).toBe(false);
    expect(accepts({ retry: 6 })).toBe(false);
    expect(accepts({ retry: 1.5 })).toBe(false);
  });
});

describe('nextNodeKey', () => {
  it('비어 있는 가장 작은 번호를 쓴다', () => {
    const g = graph([node('http_1', 'http'), node('http_3', 'http')], []);
    expect(nextNodeKey(g, 'http')).toBe('http_2');
    expect(nextNodeKey(g, 'condition')).toBe('condition_1');
  });
});
