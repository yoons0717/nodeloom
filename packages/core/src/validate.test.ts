import { describe, expect, it } from 'vitest';
import { canConnect, checkGraph, validateGraph } from './validate.js';
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

  it('GET 요청에 본문이 있으면 본문 칸에 보고한다', () => {
    const bodyIssue = (method: string, body: string) => {
      const g = rainFlow();
      g.nodes[1]!.config = { url: 'https://example.com', method, body };
      return validateGraph(g).find((i) => i.field === 'body');
    };
    expect(bodyIssue('GET', '{ "a": 1 }')).toMatchObject({
      code: 'invalid_config',
    });
    expect(bodyIssue('GET', '  ')).toBeUndefined();
    expect(bodyIssue('POST', '{ "a": 1 }')).toBeUndefined();
    expect(bodyIssue('DELETE', '{ "a": 1 }')).toBeUndefined();
  });

  it('cron은 분 단위 5자리만 받는다', () => {
    const cronIssue = (cron: string | null) => {
      const g = rainFlow();
      g.nodes[0]!.config = { cron };
      return validateGraph(g).find((i) => i.field === 'cron');
    };
    expect(cronIssue(null)).toBeUndefined();
    expect(cronIssue('0 7 * * *')).toBeUndefined();
    expect(cronIssue('*/15 9-18 * * 1-5')).toBeUndefined();
    expect(cronIssue('0 25 * * *')).toMatchObject({ code: 'invalid_config' });
    expect(cronIssue('매일')).toMatchObject({ code: 'invalid_config' });
    // 초가 들어간 6자리는 스케줄러가 분 단위로 돌아서 받지 않는다.
    expect(cronIssue('0 0 7 * * *')).toMatchObject({ code: 'invalid_config' });
    expect(cronIssue('0 7 * *')).toMatchObject({ code: 'invalid_config' });
  });

  it('잘못된 참조 키와 중복 키를 보고한다', () => {
    const g = rainFlow();
    g.nodes[2]!.key = 'Cond';
    g.nodes[3]!.key = 'weather_1';
    expect(codes(g)).toEqual(
      expect.arrayContaining(['invalid_key', 'duplicate_key']),
    );
  });

  it('참조 키 끝에 허용되지 않는 글자가 있으면 보고한다', () => {
    const g = rainFlow();
    g.nodes[1]!.key = 'http_1-x';
    expect(codes(g)).toContain('invalid_key');
  });

  it('한 칸에 오류가 여러 개여도 그 칸은 한 번만 보고한다', () => {
    const g = rainFlow();
    // 쿼리 값 두 개가 모두 문자열이 아니다.
    g.nodes[1]!.config = { url: 'https://example.com', query: { a: 1, b: 2 } };
    expect(validateGraph(g).filter((i) => i.field === 'query')).toHaveLength(1);
  });

  it('Trigger는 정확히 1개여야 한다', () => {
    const g = rainFlow();
    g.nodes.push(node('trigger_2', 'trigger'));
    expect(codes(g)).toContain('trigger_count');
    expect(codes(graph([], []))).toContain('trigger_count');
  });

  it('Condition의 양쪽 갈래 모두 Trigger에서 이어진 것으로 본다', () => {
    const g = rainFlow();
    g.nodes.push(node('alt_1', 'transform', { expression: '1' }));
    g.edges.push(edge('cond_1', 'alt_1', 'false'));
    expect(validateGraph(g)).toEqual([]);
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

  it('출발이나 도착 한쪽만 잘못돼도 보고한다', () => {
    const issueOf = (e: ReturnType<typeof edge>) => {
      const g = rainFlow();
      g.edges.push(e);
      return validateGraph(g).filter((i) => i.edgeId === e.id);
    };
    expect(issueOf(edge('ghost', 'msg_1'))).toMatchObject([
      { code: 'unknown_node' },
    ]);
    expect(issueOf(edge('weather_1', 'ghost'))).toMatchObject([
      { code: 'unknown_node' },
    ]);
    expect(issueOf(edge('weather_1', 'msg_1', 'bad'))).toMatchObject([
      { code: 'invalid_port' },
    ]);
    // 이미 있는 weather_1 → cond_1과 도착 포트만 다르다. 중복 연결이 아니다.
    expect(issueOf(edge('weather_1', 'cond_1', 'out', 'bad'))).toMatchObject([
      { code: 'invalid_port' },
    ]);
  });

  it('출발이 같아도 포트나 도착이 다르면 중복 연결이 아니다', () => {
    const g = rainFlow();
    // 이미 cond_1:true → msg_1, weather_1 → cond_1이 있다.
    g.edges.push(edge('cond_1', 'msg_1', 'false'));
    g.edges.push(edge('weather_1', 'msg_1'));
    expect(codes(g)).not.toContain('duplicate_edge');
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

  it('없는 노드와의 연결을 거부한다', () => {
    expect(canConnect(g, out('ghost'), inp('msg_1'))).toMatchObject({
      ok: false,
      code: 'unknown_node',
    });
    expect(canConnect(g, out('weather_1'), inp('ghost'))).toMatchObject({
      ok: false,
      code: 'unknown_node',
    });
  });

  it('출발이나 도착 한쪽 포트만 틀려도 거부한다', () => {
    expect(canConnect(g, out('weather_1'), out('msg_1'))).toMatchObject({
      ok: false,
      code: 'invalid_port',
    });
    expect(canConnect(g, inp('weather_1'), inp('msg_1'))).toMatchObject({
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

describe('checkGraph', () => {
  it('형식이 맞고 문제가 없으면 그래프를, 아니면 문제 목록을 돌려준다', () => {
    expect(checkGraph(rainFlow())).toMatchObject({ ok: true });
    expect(checkGraph({ nodes: 'x' })).toEqual({
      ok: false,
      issues: [
        { code: 'invalid_graph', message: '그래프 형식이 올바르지 않습니다' },
      ],
    });
    const g = rainFlow();
    g.nodes.push(node('orphan_1', 'transform', { expression: '1' }));
    expect(checkGraph(g)).toMatchObject({
      ok: false,
      issues: [{ code: 'unreachable' }],
    });
  });
});
