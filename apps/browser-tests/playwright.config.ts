import { defineConfig } from '@playwright/test';

const PORT = 3100;

// 성능 벤치. 개발 모드는 React가 검사용으로 렌더를 두 번 하는 등 수치가 부풀어서, 프로덕션 빌드를 띄워 잰다.
// CI에서는 돌리지 않는다. 같은 기기에서 개선 전후를 비교하는 용도다.
export default defineConfig({
  testDir: 'bench',
  testMatch: '**/*.bench.ts',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: `pnpm --dir ../.. turbo run build --filter=@nodeloom/web && pnpm --dir ../web exec next start -p ${PORT}`,
    env: { NEXT_PUBLIC_BENCH: '1' },
    url: `http://localhost:${PORT}/bench`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
