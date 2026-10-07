import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

// 실제 Postgres 18 컨테이너를 띄우고 저장소의 마이그레이션을 그대로 적용한다(DECISIONS 10-2).
// 앱 모듈은 import할 때 환경 변수를 읽으므로, 이 함수를 부른 뒤에 앱을 import해야 한다.
export async function startTestDatabase() {
  const container = await new PostgreSqlContainer('postgres:18').start();
  const url = container.getConnectionUri();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  process.env.DATABASE_URL = url;
  return container;
}
