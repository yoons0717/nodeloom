import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  startTestApp,
  TEST_JWT_SECRET,
  TEST_PASSWORD,
} from '../test-app.test-util.js';

const cookieOf = (res: request.Response) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('nodeloom_session=')) ?? '';
};

describe('/auth', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());
  const withToken = (token: string) =>
    api().get('/workflows').set('Cookie', `nodeloom_session=${token}`);

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('비밀번호가 맞으면 JavaScript가 읽을 수 없는 7일짜리 쿠키를 발급한다', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ password: TEST_PASSWORD })
      .expect(204);
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=604800/);
  });

  it('로그인한 쿠키로는 보호된 API를 쓰고, 내 역할은 admin이다', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ password: TEST_PASSWORD })
      .expect(204);
    await agent.get('/workflows').expect(200);
    const me = await agent.get('/auth/me').expect(200);
    expect(me.body).toEqual({ role: 'admin' });
  });

  it('비밀번호가 틀리면 401이고 쿠키를 주지 않는다', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ password: 'wrong' })
      .expect(401);
    expect(cookieOf(res)).toBe('');
  });

  it('쿠키가 없으면 보호된 API는 401이고, /health는 그대로 열려 있다', async () => {
    await api().get('/workflows').expect(401);
    await api().get('/auth/me').expect(401);
    await api().get('/health').expect(200);
  });

  it('다른 키로 서명했거나 만료된 토큰은 401이다', async () => {
    const forged = new JwtService({ secret: 'other-secret'.padEnd(32, 'y') });
    await withToken(await forged.signAsync({ role: 'admin' })).expect(401);

    const ours = new JwtService({ secret: TEST_JWT_SECRET });
    const expired = await ours.signAsync({
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await withToken(expired).expect(401);
  });

  it('토큰이 망가져 있어도 로그아웃으로 쿠키를 지울 수 있다', async () => {
    const res = await api()
      .post('/auth/logout')
      .set('Cookie', 'nodeloom_session=broken')
      .expect(204);
    expect(cookieOf(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  // 속도 제한은 이 파일의 다른 로그인 시도에도 영향을 주므로 마지막에 둔다.
  it('같은 IP에서 1분에 5번을 넘게 로그인하면 429이다', async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) {
      last = (await api().post('/auth/login').send({ password: 'wrong' }))
        .status;
    }
    expect(last).toBe(429);
  });
});
