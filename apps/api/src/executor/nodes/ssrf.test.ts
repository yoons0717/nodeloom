import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EvalContext, GraphNode } from '@nodeloom/core';
import { MockModule } from '../../mock/mock.module.js';
import { NodeError } from './node-error.js';
import { runNode } from './run-node.js';
import { createHttpGuard, type HttpPolicy } from './ssrf.js';

const ctx: EvalContext = { input: {}, nodes: {}, run: {}, secrets: {} };
const http = (url: string): GraphNode => ({
  id: 'h',
  key: 'h',
  type: 'http',
  title: 'h',
  position: { x: 0, y: 0 },
  config: { url },
});

describe('외부 요청 보안(SSRF)', () => {
  let app: INestApplication;
  let base: string;
  let port: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    port = new URL(base).port;
  });

  afterAll(async () => {
    await app?.close();
  });

  const policy = (p: Partial<HttpPolicy> = {}): HttpPolicy => ({
    mockBase: `${base}/mock`,
    demo: false,
    allowPrivate: [],
    ...p,
  });
  // 요청을 보내 성공하면 응답 코드, 실패하면 오류 문구
  const send = async (url: string, p?: Partial<HttpPolicy>) => {
    try {
      await runNode(http(url), ctx, { guard: createHttpGuard(policy(p)) });
      return 'ok';
    } catch (e) {
      expect(e).toBeInstanceOf(NodeError);
      expect((e as NodeError).retryable).toBe(false);
      return (e as NodeError).message;
    }
  };

  it('IP를 바로 적은 내부 주소는 형태와 관계없이 막는다', async () => {
    for (const url of [
      `http://127.0.0.1:${port}/`,
      `https://127.0.0.1:${port}/`, // request-filtering-agent CVE-2025-57814에서 https만 빠졌던 경우
      `http://2130706433:${port}/`, // 127.0.0.1을 숫자 하나로 쓴 것
      `http://0x7f.1:${port}/`,
      `http://[::1]:${port}/`,
      `http://[::ffff:127.0.0.1]:${port}/`,
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://192.168.0.1/',
      'http://[fe80::1]/',
      'http://0.0.0.0/',
    ]) {
      expect(await send(url), url).toMatch(
        /^내부 주소\(.+\)로는 요청할 수 없습니다$/,
      );
    }
  });

  it('이름을 IP로 바꾼 결과가 내부 주소면 연결하지 않는다', async () => {
    expect(
      await send(`http://localhost:${port}/mock/weather`, {
        mockBase: 'http://mock.invalid/mock',
      }),
    ).toMatch(/^내부 주소/);
  });

  it('클라우드 메타데이터 주소는 허용 목록에 있어도 막는다', async () => {
    expect(
      await send('http://169.254.169.254/latest/meta-data', {
        allowPrivate: ['169.254.0.0/16'],
      }),
    ).toMatch(/^클라우드 메타데이터 주소/);
  });

  it('HTTP_ALLOW_PRIVATE에 적은 대상만 허용한다', async () => {
    const elsewhere = { mockBase: 'http://mock.invalid/mock' };
    expect(
      await send(`http://localhost:${port}/mock/weather`, {
        ...elsewhere,
        allowPrivate: ['127.0.0.0/8', '::1'],
      }),
    ).toBe('ok');
    expect(
      await send(`http://127.0.0.1:${port}/mock/weather`, {
        ...elsewhere,
        allowPrivate: ['127.0.0.2'],
      }),
    ).toMatch(/^내부 주소/);
  });

  it('연습용 응답 주소는 예외이고, 리다이렉트는 따라가지 않는다', async () => {
    expect(await send(`${base}/mock/weather`)).toBe('ok');
    expect(
      await send(
        `${base}/mock/redirect?to=${encodeURIComponent(`${base}/mock/weather`)}`,
      ),
    ).toBe('응답 코드 302');
  });

  it('http, https만 허용하고, 데모에서는 연습용 응답만 허용한다', async () => {
    expect(await send('ftp://example.com/')).toBe(
      'http, https 주소만 요청할 수 있습니다',
    );
    expect(await send('https://example.com/', { demo: true })).toBe(
      '데모에서는 연습용 주소(/mock)로만 요청할 수 있습니다',
    );
    expect(await send(`${base}/mock/weather`, { demo: true })).toBe('ok');
  });
});
