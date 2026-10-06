import { existsSync } from 'node:fs';
import { z } from 'zod';

// 로컬에서는 루트 .env를 읽는다. CI와 운영에서는 환경 변수가 직접 주입된다.
const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(4000),
});

export const env = schema.parse(process.env);
