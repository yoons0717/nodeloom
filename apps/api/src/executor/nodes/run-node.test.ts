import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EvalContext, GraphNode, NodeType } from '@nodeloom/core';
import { MockModule } from '../../mock/mock.module.js';
import { NodeError } from './node-error.js';
import { runNode } from './run-node.js';

const node = (type: NodeType, config: Record<string, unknown>): GraphNode => ({
  id: 'n1',
  key: 'n1',
  type,
  title: 'n1',
  position: { x: 0, y: 0 },
  config,
});
const ctx: EvalContext = {
  input: { city: 'Busan', ok: true },
  nodes: {},
  run: { id: 'r1' },
  secrets: { TOKEN: 'secret-token' },
};
const failure = (p: Promise<unknown>) =>
  p.then(
    () => expect.fail('실패해야 합니다'),
    (e: unknown) => {
      expect(e).toBeInstanceOf(NodeError);
      return e as NodeError;
    },
  );

describe('노드 실행기', () => {
  let app: INestApplication;
  let base: string;
  const http = (config: Record<string, unknown>) =>
    runNode(
      node('http', { ...config, url: `${base}${String(config.url)}` }),
      ctx,
    );

  // DB 없이 연습용 응답만 띄운다.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('Trigger는 입력을, Transform은 식 결과를 내보낸다', async () => {
    expect(await runNode(node('trigger', {}), ctx)).toEqual({
      output: ctx.input,
    });
    expect(
      await runNode(node('transform', { expression: '{ "c": city }' }), ctx),
    ).toEqual({ output: { c: 'Busan' } });
  });

  it('Condition은 참·거짓 포트로 나가고, 결과가 불리언이 아니면 실패', async () => {
    expect(await runNode(node('condition', { expression: 'ok' }), ctx)).toEqual(
      { output: ctx.input, port: 'true' },
    );
    expect(
      await runNode(node('condition', { expression: 'city = "Seoul"' }), ctx),
    ).toMatchObject({ port: 'false' });
    const e = await failure(
      runNode(node('condition', { expression: 'city' }), ctx),
    );
    expect(e.message).toContain('참·거짓이 아닙니다');
  });

  it('식 오류는 재시도하지 않는 실패', async () => {
    const e = await failure(
      runNode(node('transform', { expression: 'city + 1' }), ctx),
    );
    expect(e.retryable).toBe(false);
  });

  it('HTTP: URL·쿼리·헤더의 {{ }}를 채우고 본문 식을 JSON으로 보낸다', async () => {
    const { output } = await http({
      method: 'POST',
      url: '/mock/echo?from={{ city }}',
      query: { q: '{{ $run.id }}' },
      headers: { authorization: 'Bearer {{ $secrets.TOKEN }}' },
      body: '{ "text": city & " 날씨" }',
    });
    expect(output).toMatchObject({
      method: 'POST',
      query: { from: 'Busan', q: 'r1' },
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: { text: 'Busan 날씨' },
    });
  });

  it('HTTP: 2xx가 아니면 실패. 5xx·408·429만 재시도 대상', async () => {
    const e500 = await failure(http({ url: '/mock/status/500' }));
    expect(e500).toMatchObject({
      retryable: true,
      details: { status: 500, body: { status: 500 } },
    });
    expect(await failure(http({ url: '/mock/status/429' }))).toMatchObject({
      retryable: true,
    });
    expect(await failure(http({ url: '/mock/status/404' }))).toMatchObject({
      retryable: false,
    });
  });

  it('HTTP: "2xx가 아니어도 계속"이면 { status, body }를 내보낸다', async () => {
    expect(
      await http({ url: '/mock/status/503', continueOnNon2xx: true }),
    ).toEqual({ output: { status: 503, body: { status: 503 } } });
  });

  it('HTTP: 시간 초과와 연결 실패는 재시도 대상', async () => {
    expect(
      await failure(http({ url: '/mock/slow?ms=1500', timeoutSec: 1 })),
    ).toMatchObject({ retryable: true, message: '1초 안에 응답이 없습니다' });
    expect(
      await failure(runNode(node('http', { url: 'http://localhost:1' }), ctx)),
    ).toMatchObject({ retryable: true });
  });

  it('HTTP: 응답이 1MB를 넘으면 재시도하지 않는 실패', async () => {
    await http({ url: `/mock/bytes/${1024 * 1024}` });
    expect(
      await failure(http({ url: `/mock/bytes/${1024 * 1024 + 1}` })),
    ).toMatchObject({ retryable: false });
  });
});
