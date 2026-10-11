import { execFileSync } from 'node:child_process';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import bcrypt from 'bcryptjs';

export const TEST_PASSWORD = 'test-password';
export const TEST_JWT_SECRET = 'test-secret-'.padEnd(32, 'x');

// 실제 Postgres 18 컨테이너에 저장소의 마이그레이션을 적용하고, main.ts와 같은 설정으로 앱을 띄운다(DECISIONS 10-2).
// 앱 모듈은 import할 때 환경 변수를 읽으므로 환경 변수를 먼저 넣고 import한다. 테스트 파일마다 모듈이 새로 로드된다.
// customize로 테스트에서만 바꿀 provider를 갈아 끼운다(예: pg-boss 시계).
export async function startTestApp(
  overrides: Record<string, string> = {},
  customize: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
) {
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
  // 테스트 파일이 env.ts를 읽는 모듈을 맨 위에서 import하면 env.ts가 위 값을 넣기 전에 로컬 .env로 굳는다.
  const { env } = await import('./env.js');
  if (env.DATABASE_URL !== url) {
    throw new Error(
      'env.ts가 startTestApp보다 먼저 로드됐습니다. 테스트 파일에서는 import type을 쓰고 값은 앱을 띄운 뒤 import하세요',
    );
  }
  const { setupApp } = await import('./app.setup.js');
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = setupApp(
    moduleRef.createNestApplication<NestExpressApplication>(),
  );
  await app.init();
  return { app, container };
}
