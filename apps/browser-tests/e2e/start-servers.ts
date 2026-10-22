// e2e용 서버를 모두 띄운다: Postgres 컨테이너 → 마이그레이션 → api(4300) → web(3300).
// 개발 서버(3000/4000)와 개발 DB는 건드리지 않는다. Playwright가 이 프로세스를 끝내면 모두 정리한다.
// E2E_MODE=demo면 api를 데모 모드로 띄운다. api는 시작할 때 모드를 한 번 읽으므로 모드마다 따로 띄운다.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import bcrypt from 'bcryptjs';
import { API_PORT, E2E_PASSWORD, WEB_PORT } from './config.ts';

const demo = process.env.E2E_MODE === 'demo';
// pathname은 공백·한글을 %로 인코딩한 채 돌려주므로 파일 경로로 바꿔서 쓴다.
const root = fileURLToPath(new URL('../../../', import.meta.url));

const container = await new PostgreSqlContainer('postgres:18').start();
const env = {
  ...process.env,
  DATABASE_URL: container.getConnectionUri(),
  API_URL: `http://localhost:${API_PORT}`,
};

execFileSync(
  'pnpm',
  ['--filter', '@nodeloom/api', 'exec', 'prisma', 'migrate', 'deploy'],
  {
    cwd: root,
    env,
    stdio: 'inherit',
  },
);

const children: ChildProcess[] = [
  spawn('node', ['apps/api/dist/main.js'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...env,
      PORT: String(API_PORT),
      // 로컬 http에서도 로그인 쿠키가 저장되도록 Secure를 끈다(운영에서만 켜짐).
      NODE_ENV: 'test',
      DEMO_MODE: String(demo),
      ADMIN_PASSWORD_HASH: demo ? '' : bcrypt.hashSync(E2E_PASSWORD, 4),
      JWT_SECRET: demo ? '' : randomBytes(32).toString('hex'),
    },
  }),
  spawn(
    'pnpm',
    [
      '--filter',
      '@nodeloom/web',
      'exec',
      'next',
      'start',
      '-p',
      String(WEB_PORT),
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env,
    },
  ),
];

// Playwright가 끝내라고 신호를 보내면 정상 종료(0), api나 web이 스스로 죽었으면 실패(1)로 끝낸다.
let stopping = false;
async function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  await container.stop();
  process.exit(code);
}
process.on('SIGTERM', () => void stop(0));
process.on('SIGINT', () => void stop(0));
for (const child of children) child.on('exit', () => void stop(1));
