import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { z } from 'zod';

// 로컬에서는 루트 .env를 읽는다. CI와 운영에서는 환경 변수가 직접 주입된다.
const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// `.env`에 `JWT_SECRET=`처럼 비워 둔 칸은 없는 것으로 본다.
const optional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), s.optional());

// IP 하나 또는 대역(192.168.0.10, 10.0.0.0/24)
const ipOrSubnet = z.string().refine(
  (v) => {
    const [ip, prefix, ...rest] = v.split('/');
    const version = isIP(ip);
    if (!version || rest.length > 0) return false;
    if (prefix === undefined) return true;
    const n = Number(prefix);
    return Number.isInteger(n) && n >= 0 && n <= (version === 4 ? 32 : 128);
  },
  {
    error: (i) =>
      `HTTP_ALLOW_PRIVATE의 "${String(i.input)}"는 IP나 대역이 아닙니다`,
  },
);

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

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
    // 스케줄과 화면 시각의 시간대(DECISIONS 3-5)
    APP_TIMEZONE: z
      .string()
      .default('Asia/Seoul')
      .refine(isTimeZone, {
        error: (i) => `APP_TIMEZONE의 "${String(i.input)}"는 시간대 이름이 아닙니다`,
      }),
    // 실행 한 번의 전체 시간 제한, 초(DECISIONS 7-3, B-13)
    RUN_TIMEOUT: z.coerce.number().int().positive().default(300),
    // 연습용 응답 주소(DECISIONS B-7). 비우면 api 자신
    MOCK_BASE_URL: optional(z.url()),
    // 예외로 요청을 허용할 내부 IP나 대역, 쉼표로 구분(DECISIONS 8-1)
    HTTP_ALLOW_PRIVATE: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(ipOrSubnet)),
  })
  .refine((e) => e.DEMO_MODE || (e.ADMIN_PASSWORD_HASH && e.JWT_SECRET), {
    error: '데모 모드가 아니면 ADMIN_PASSWORD_HASH와 JWT_SECRET이 필요합니다',
  });

const parsed = schema.parse(process.env);
export const env = {
  ...parsed,
  MOCK_BASE_URL: parsed.MOCK_BASE_URL ?? `http://localhost:${parsed.PORT}/mock`,
};

// `$secrets.<이름>`으로 쓸 비밀값(DECISIONS 2-3). 접두어가 붙은 환경 변수만 읽는다.
// 짧은 값은 가리기(8-2)가 다른 글자까지 바꿔 버리므로 8자 이상만 받는다.
const SECRET_PREFIX = 'NODELOOM_SECRET_';
export const secrets: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith(SECRET_PREFIX) || !value) continue;
  if (value.length < 8) throw new Error(`${key}는 8자 이상이어야 합니다`);
  secrets[key.slice(SECRET_PREFIX.length)] = value;
}
