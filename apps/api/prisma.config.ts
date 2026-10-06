import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// 로컬에서는 루트 .env를 읽는다. CI와 운영에서는 환경 변수가 직접 주입된다.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
