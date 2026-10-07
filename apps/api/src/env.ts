import { existsSync } from 'node:fs';
import { z } from 'zod';

// 로컬에서는 루트 .env를 읽는다. CI와 운영에서는 환경 변수가 직접 주입된다.
const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// `.env`에 `JWT_SECRET=`처럼 비워 둔 칸은 없는 것으로 본다.
const optional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), s.optional());

const schema = z
  .object({
    DATABASE_URL: z.url(),
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.string().default('development'),
    // 공개 데모 서버(DECISIONS 6-5). 로그인 없이 demo 사용자로 접근한다.
    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    // bcrypt 해시(DECISIONS D-4, K-1). `pnpm admin:hash`로 만든다.
    ADMIN_PASSWORD_HASH: optional(z.string()),
    // JWT 서명 키. 바꾸면 발급한 로그인이 모두 풀린다(DECISIONS B-3).
    JWT_SECRET: optional(
      z.string().min(32, { error: 'JWT_SECRET은 32자 이상이어야 합니다' }),
    ),
  })
  .refine((e) => e.DEMO_MODE || (e.ADMIN_PASSWORD_HASH && e.JWT_SECRET), {
    error: '데모 모드가 아니면 ADMIN_PASSWORD_HASH와 JWT_SECRET이 필요합니다',
  });

export const env = schema.parse(process.env);
