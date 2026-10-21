import { defineConfig } from '@playwright/test';
import { API_PORT, WEB_PORT } from './e2e/config.ts';

const demo = process.env.E2E_MODE === 'demo';

// 핵심 사용자 흐름 e2e. 프로덕션 빌드를 띄워 실제 배포와 같은 조건에서 확인한다.
// 관리자 모드와 데모 모드는 api 설정이 달라서 E2E_MODE로 나눠 두 번 실행한다(`pnpm e2e`).
export default defineConfig({
  testDir: 'e2e',
  // VITALS=1이면 화면별 JS 크기와 LCP·INP를 재고(vitals.shot.ts), SHOTS=1이면 README 화면 이미지를 찍는다(screenshots.shot.ts).
  testMatch: process.env.VITALS
    ? 'vitals.shot.ts'
    : process.env.SHOTS
      ? 'screenshots.shot.ts'
      : demo
        ? 'demo.e2e.ts'
        : 'admin.e2e.ts',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    // 웹의 rewrites 주소는 빌드할 때 정해지므로 API_URL을 넣고 빌드한다.
    command: `pnpm --dir ../.. turbo run build --filter=@nodeloom/web --filter=@nodeloom/api && node e2e/start-servers.ts`,
    env: { API_URL: `http://localhost:${API_PORT}` },
    url: `http://localhost:${WEB_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
