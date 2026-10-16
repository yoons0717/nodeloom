import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { API_PORT, E2E_PASSWORD } from './config.ts';

// 화면별 JS 다운로드 양과 LCP·INP를 잰다. `pnpm --filter @nodeloom/browser-tests vitals`
// e2e와 같은 서버(새 Postgres, 프로덕션 빌드)에서 잰다. web-vitals는 앱에 넣지 않고 페이지를 열 때 주입한다.
const RUNS = 3;
// 패키지가 IIFE 파일을 exports에 열어 두지 않아서, 기본 진입점의 폴더에서 읽는다.
const webVitals = readFileSync(
  join(
    dirname(createRequire(import.meta.url).resolve('web-vitals')),
    'web-vitals.iife.js',
  ),
  'utf8',
);

type Vitals = { lcp: number; inp: number; jsKb: number; scripts: string[] };

const node = (key: string, type: string, x: number, config = {}) => ({
  id: key,
  key,
  type,
  title: key,
  position: { x, y: 0 },
  config,
});
const graph = {
  schemaVersion: 1,
  nodes: [
    node('trigger_1', 'trigger', 0, { cron: '0 7 * * *' }),
    node('http_1', 'http', 200, {
      url: `http://localhost:${API_PORT}/mock/weather`,
    }),
    node('transform_1', 'transform', 400, { expression: '"오늘 " & city' }),
  ],
  edges: [
    {
      id: 'e1',
      from: { node: 'trigger_1', port: 'out' },
      to: { node: 'http_1', port: 'in' },
    },
    {
      id: 'e2',
      from: { node: 'http_1', port: 'out' },
      to: { node: 'transform_1', port: 'in' },
    },
  ],
};

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('비밀번호').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/$/);
}

// 화면 하나를 새 브라우저 상태(캐시 없음)로 열어 잰다. interact가 있으면 조작한 뒤 INP를 읽는다.
async function measure(
  browser: Browser,
  cookies: Awaited<ReturnType<BrowserContext['cookies']>>,
  path: string,
  ready: (page: Page) => Promise<void>,
  interact?: (page: Page) => Promise<void>,
): Promise<Vitals> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(cookies);
  await context.addInitScript(`${webVitals}
    window.__vitals = { lcp: 0, inp: 0 };
    webVitals.onLCP((m) => (window.__vitals.lcp = m.value), { reportAllChanges: true });
    webVitals.onINP((m) => (window.__vitals.inp = m.value), { reportAllChanges: true });`);
  const page = await context.newPage();
  await page.goto(path);
  await ready(page);
  await page.waitForTimeout(500);
  if (interact) await interact(page);
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const scripts = performance
      .getEntriesByType('resource')
      .filter((e) => e.name.endsWith('.js')) as PerformanceResourceTiming[];
    const v = (window as unknown as { __vitals: { lcp: number; inp: number } })
      .__vitals;
    return {
      lcp: v.lcp,
      inp: v.inp,
      jsKb: scripts.reduce((s, e) => s + e.encodedBodySize, 0) / 1024,
      scripts: scripts.map((e) => new URL(e.name).pathname),
    };
  });
  await context.close();
  return result;
}

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

test('화면별 JS 크기와 LCP·INP', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await login(page);
  const cookies = await page.context().cookies();
  const res = await page.request.post('/api/workflows', {
    data: { name: '측정용', graph },
  });
  const { id } = (await res.json()) as { id: string };
  const run = await page.request.post(`/api/workflows/${id}/runs`);
  const { runId } = (await run.json()) as { runId: string };
  await expect
    .poll(
      async () =>
        (
          (await (
            await page.request.get(`/api/runs/${runId}/status`)
          ).json()) as { status: string }
        ).status,
    )
    .toBe('SUCCESS');

  const card = (p: Page, key: string) =>
    p.locator(`.react-flow__node:has([data-key="${key}"])`);
  const screens: [
    string,
    string,
    (p: Page) => Promise<void>,
    ((p: Page) => Promise<void>)?,
  ][] = [
    ['목록', '/', (p) => p.getByText('측정용').first().waitFor()],
    [
      '에디터',
      `/w/${id}`,
      (p) => card(p, 'http_1').waitFor(),
      async (p) => {
        await card(p, 'http_1').click({ position: { x: 12, y: 12 } });
        await p.getByLabel('URL').click();
        await p.keyboard.type('?q=1');
      },
    ],
    [
      '실행 상세',
      `/w/${id}/runs/${runId}`,
      (p) => card(p, 'transform_1').waitFor(),
      async (p) => {
        await card(p, 'transform_1').click();
        await p.getByText('출력', { exact: true }).waitFor();
      },
    ],
  ];

  const rows: string[] = [
    '| 화면 | JS(KB, 압축 전송) | LCP(ms) | INP(ms) |',
    '|---|---|---|---|',
  ];
  const scriptsBy: Record<string, string[]> = {};
  for (const [name, path, ready, interact] of screens) {
    const results: Vitals[] = [];
    for (let i = 0; i < RUNS; i++)
      results.push(await measure(browser, cookies, path, ready, interact));
    scriptsBy[name] = results[0]!.scripts;
    rows.push(
      `| ${name} | ${median(results.map((r) => r.jsKb)).toFixed(1)} | ${median(results.map((r) => r.lcp)).toFixed(0)} | ${interact ? median(results.map((r) => r.inp)).toFixed(0) : '-'} |`,
    );
  }
  console.log(`\n${rows.join('\n')}\n`);
  console.log(JSON.stringify(scriptsBy));
});

// 실행 상세에서 큰 출력(약 0.94MB, 항목 1만 5천 개)을 가진 노드를 눌러 JSON 보기가 다 그려지기까지를 잰다(M9 9-c).
// 누른 순간부터 화면의 요소 수가 더 늘지 않을 때까지의 시간이라, 출력을 받아 오는 시간도 들어 있다.
test('큰 JSON 보기', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const big = {
    schemaVersion: 1,
    nodes: [
      node('trigger_1', 'trigger', 0),
      node('http_1', 'http', 200, {
        url: `http://localhost:${API_PORT}/mock/items/15000`,
      }),
    ],
    edges: [graph.edges[0]],
  };
  const res = await page.request.post('/api/workflows', {
    data: { name: '큰 출력', graph: big },
  });
  const { id } = (await res.json()) as { id: string };
  const run = await page.request.post(`/api/workflows/${id}/runs`);
  const { runId } = (await run.json()) as { runId: string };
  await expect
    .poll(
      async () =>
        (
          (await (
            await page.request.get(`/api/runs/${runId}/status`)
          ).json()) as { status: string }
        ).status,
    )
    .toBe('SUCCESS');

  const results: { ms: number; added: number; longest: number }[] = [];
  for (let i = 0; i < RUNS; i++) {
    await page.goto(`/w/${id}/runs/${runId}`);
    const card = page.locator('.react-flow__node:has([data-key="http_1"])');
    await card.waitFor();
    await page.evaluate(() => {
      const w = window as unknown as { __json: Promise<unknown> };
      w.__json = new Promise((resolve) => {
        let longest = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            longest = Math.max(longest, e.duration);
        }).observe({ type: 'longtask' });
        addEventListener(
          'pointerdown',
          () => {
            const base = document.getElementsByTagName('*').length;
            const t0 = performance.now();
            let last = base;
            let done = t0;
            let stable = 0;
            const tick = () => {
              const n = document.getElementsByTagName('*').length;
              if (n !== last) {
                last = n;
                done = performance.now();
                stable = 0;
              } else stable++;
              if (stable < 30 && performance.now() - t0 < 20_000)
                requestAnimationFrame(tick);
              else resolve({ ms: done - t0, added: last - base, longest });
            };
            requestAnimationFrame(tick);
          },
          { once: true, capture: true },
        );
      });
    });
    await card.click({ position: { x: 12, y: 12 } });
    results.push(
      (await page.evaluate(
        () => (window as unknown as { __json: Promise<unknown> }).__json,
      )) as { ms: number; added: number; longest: number },
    );
  }
  const m = (k: 'ms' | 'added' | 'longest') =>
    median(results.map((r) => r[k])).toFixed(0);
  console.log(
    `\n| 큰 JSON 보기 | 다 그리기까지(ms) | 늘어난 요소 수 | 가장 긴 작업(ms) |\n|---|---|---|---|\n| 항목 15000개 | ${m('ms')} | ${m('added')} | ${m('longest')} |\n`,
  );
});
