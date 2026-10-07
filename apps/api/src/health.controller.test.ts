import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { startTestApp } from './test-app.test-util.js';

// 실제 Postgres 18 컨테이너로 /health가 DB 연결까지 확인하는지 검증한다(DECISIONS 10-2).
describe('GET /health', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('로그인 없이 DB에 연결되면 ok를 반환한다', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok', graphSchemaVersion: 1 });
  });

  it('DB가 내려가면 503을 반환한다', async () => {
    await container.stop();
    await request(app.getHttpServer()).get('/health').expect(503);
  });
});
