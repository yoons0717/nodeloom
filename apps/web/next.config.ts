import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

// 로컬에서는 루트 .env를 읽는다. CI와 운영에서는 환경 변수가 직접 주입된다.
const rootEnv = new URL('../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // 브라우저는 /api/*만 부르고 Next가 같은 출처에서 NestJS로 중계한다(DECISIONS 6-4).
  rewrites: () =>
    Promise.resolve([
      { source: '/api/:path*', destination: `${apiUrl}/:path*` },
    ]),
};

export default nextConfig;
