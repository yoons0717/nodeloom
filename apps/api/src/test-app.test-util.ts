import { execFileSync } from 'node:child_process';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import bcrypt from 'bcryptjs';

export const TEST_PASSWORD = 'test-password';
export const TEST_JWT_SECRET = 'test-secret-'.padEnd(32, 'x');

// 실제 Postgres 18 컨테이너에 저장소의 마이그레이션을 적용하고, main.ts와 같은 설정으로 앱을 띄운다(DECISIONS 10-2).
// 앱 모듈은 import할 때 환경 변수를 읽으므로 환경 변수를 먼저 넣고 import한다. 테스트 파일마다 모듈이 새로 로드된다.
export async function startTestApp(overrides: Record<string, string> = {}) {
  const container = await new PostgreSqlContainer('postgres:18').start();
  const url = container.getConnectionUri();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  Object.assign(process.env, {
    DATABASE_URL: url,
    NODE_ENV: 'test',
    DEMO_MODE: 'false',
    ADMIN_PASSWORD_HASH: bcrypt.hashSync(TEST_PASSWORD, 4),
    JWT_SECRET: TEST_JWT_SECRET,
    ...overrides,
  });

  const { AppModule } = await import('./app.module.js');
  const { setupApp } = await import('./app.setup.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = setupApp(
    moduleRef.createNestApplication<NestExpressApplication>(),
  );
  await app.init();
  return { app, container };
}
