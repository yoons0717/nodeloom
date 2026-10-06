import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

// 실제 Postgres 18 컨테이너로 /health가 DB 연결까지 확인하는지 검증한다(DECISIONS 10-2).
describe('GET /health', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    const { AppModule } = await import('./app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('returns ok when the database is reachable', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok', graphSchemaVersion: 1 });
  });

  it('returns 503 when the database is down', async () => {
    await container.stop();
    await request(app.getHttpServer()).get('/health').expect(503);
  });
});
