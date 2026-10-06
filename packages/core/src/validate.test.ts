import { describe, expect, it } from 'vitest';
import { canConnect, validateGraph } from './validate.js';
import { edge, graph, node, rainFlow } from './fixtures.test-util.js';

const codes = (g: Parameters<typeof validateGraph>[0]) =>
  validateGraph(g).map((i) => i.code);

describe('validateGraph', () => {
  it('예시 흐름에서는 문제가 없다', () => {
    expect(validateGraph(rainFlow())).toEqual([]);
  });

  it('잘못된 노드 설정을 칸 이름과 함께 칸마다 보고한다', () => {
    const g = rainFlow();
    g.nodes[1]!.config = { timeoutSec: 99 };
    expect(
      validateGraph(g)
        .filter((i) => i.code === 'invalid_config')
        .map((i) => i.field),
    ).toEqual(['url', 'timeoutSec']);
  });

  it('잘못된 참조 키와 중복 키를 보고한다', () => {
    const g = rainFlow();
    g.nodes[2]!.key = 'Cond';
    g.nodes[3]!.key = 'weather_1';
    expect(codes(g)).toEqual(
      expect.arrayContaining(['invalid_key', 'duplicate_key']),
    );
  });

  it('Trigger는 정확히 1개여야 한다', () => {
    const g = rainFlow();
    g.nodes.push(node('trigger_2', 'trigger'));
    expect(codes(g)).toContain('trigger_count');
    expect(codes(graph([], []))).toContain('trigger_count');
  });

  it('Trigger에서 이어지지 않은 노드를 보고한다', () => {
    const g = rainFlow();
    g.nodes.push(node('orphan_1', 'transform', { expression: '1' }));
    expect(validateGraph(g)).toContainEqual(
      expect.objectContaining({ code: 'unreachable', nodeId: 'orphan_1' }),
    );
  });

  it('없는 노드, 틀린 포트, 자기 연결, 중복 연결을 보고한다', () => {
    const g = rainFlow();
    g.edges.push(edge('weather_1', 'ghost'));
    g.edges.push(edge('cond_1', 'msg_1', 'out'));
    g.edges.push(edge('msg_1', 'msg_1'));
    g.edges.push(edge('weather_1', 'cond_1'));
    expect(codes(g)).toEqual(
      expect.arrayContaining([
        'unknown_node',
        'invalid_port',
        'self_loop',
        'duplicate_edge',
      ]),
    );
  });

  it('없는 참조 키를 가리키면 보고한다', () => {
    const g = rainFlow();
    g.nodes[3]!.config = { expression: '$nodes.nope_1.body' };
    expect(validateGraph(g)).toContainEqual(
      expect.objectContaining({ code: 'unknown_ref', nodeId: 'msg_1' }),
    );
  });

  it('순환에 걸린 노드를 모두 보고한다', () => {
    const g = rainFlow();
    g.edges.push(edge('msg_1', 'weather_1'));
    const cycle = validateGraph(g)
      .filter((i) => i.code === 'cycle')
      .map((i) => i.nodeId);
    expect(cycle).toEqual(['weather_1', 'cond_1', 'msg_1']);
  });

  it('식 문법 오류를 보고한다', () => {
    const g = rainFlow();
    g.nodes[2]!.config = { expression: 'body.rain >' };
    expect(validateGraph(g)).toContainEqual(
      expect.objectContaining({
        code: 'expression_syntax',
        nodeId: 'cond_1',
        field: 'expression',
      }),
    );
  });
});

describe('canConnect', () => {
  const g = rainFlow();
  const out = (node: string, port = 'out') => ({ node, port });
  const inp = (node: string) => ({ node, port: 'in' });

  it('출력 포트에서 입력 포트로의 연결을 허용한다', () => {
    expect(canConnect(g, out('cond_1', 'false'), inp('notify_1'))).toEqual({
      ok: true,
    });
  });

  it('입력 포트에서 출력 포트로의 연결을 거부한다', () => {
    expect(canConnect(g, inp('msg_1'), out('weather_1'))).toMatchObject({
      ok: false,
      code: 'invalid_port',
    });
  });

  it('자기 자신으로의 연결을 거부한다', () => {
    expect(canConnect(g, out('msg_1'), inp('msg_1'))).toMatchObject({
      ok: false,
      code: 'self_loop',
    });
  });

  it('순환을 만드는 연결을 거부한다', () => {
    expect(canConnect(g, out('notify_1'), inp('weather_1'))).toMatchObject({
      ok: false,
      code: 'cycle',
    });
  });

  it('같은 연결을 거부한다', () => {
    expect(canConnect(g, out('weather_1'), inp('cond_1'))).toMatchObject({
      ok: false,
      code: 'duplicate_edge',
    });
  });
});
