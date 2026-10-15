import { expect, type Page, test } from '@playwright/test';
import { API_PORT, E2E_PASSWORD } from './config.ts';
import { nodeByKey, selectNode } from './editor.ts';

// README 화면 이미지(docs/images/*.png)를 찍는다. `pnpm --filter @nodeloom/browser-tests screenshots`
// e2e와 같은 서버(새 Postgres, 프로덕션 빌드)에 예시 흐름을 넣고 실행한 뒤 찍어서, 언제 다시 찍어도 같은 화면이 나온다.
const mock = `http://localhost:${API_PORT}/mock`;
const out = (name: string) => `../../docs/images/${name}.png`;

const node = (
  key: string,
  type: string,
  title: string,
  x: number,
  y: number,
  config: Record<string, unknown> = {},
) => ({ id: key, key, type, title, position: { x, y }, config });
const edge = (from: string, to: string, port = 'out') => ({
  id: `${from}:${port}->${to}`,
  from: { node: from, port },
  to: { node: to, port: 'in' },
});

// 날씨를 받아 기온이 20도를 넘으면 알림을 보내는 흐름. 연습용 응답(/mock)이라 외부 서비스와 비밀값이 필요 없다.
const weatherFlow = {
  schemaVersion: 1,
  nodes: [
    node('trigger_1', 'trigger', '매일 아침', 0, 120, { cron: '0 7 * * *' }),
    node('weather_1', 'http', '날씨 가져오기', 200, 120, {
      url: `${mock}/weather?city={{ city }}`,
    }),
    node('cond_1', 'condition', '20도 넘나', 400, 108, {
      expression: 'temp > 20',
    }),
    node('msg_1', 'transform', '알림 문구', 600, 40, {
      expression: '"오늘 " & city & " " & $string(temp) & "도"',
    }),
    node('quiet_1', 'transform', '알리지 않음', 600, 220, {
      expression: '"생략"',
    }),
    node('notify_1', 'http', '알림 보내기', 800, 40, {
      method: 'POST',
      url: `${mock}/echo`,
      body: '{ "content": $ }',
    }),
  ],
  edges: [
    edge('trigger_1', 'weather_1'),
    edge('weather_1', 'cond_1'),
    edge('cond_1', 'msg_1', 'true'),
    edge('cond_1', 'quiet_1', 'false'),
    edge('msg_1', 'notify_1'),
  ],
};

async function create(page: Page, name: string, graph: unknown) {
  const res = await page.request.post('/api/workflows', {
    data: { name, graph },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

test.use({ viewport: { width: 1440, height: 900 } });

test('README 화면 이미지', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('비밀번호').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/$/);

  const trigger = (cron: string | null) => ({
    schemaVersion: 1,
    nodes: [node('trigger_1', 'trigger', '시작', 0, 0, { cron })],
    edges: [],
  });
  await create(page, '서버 상태 점검', trigger('0 * * * *'));
  await create(page, '주간 보고 모으기', trigger('0 9 * * 1'));
  const id = await create(page, '아침 기온 알림', {
    ...weatherFlow,
    nodes: weatherFlow.nodes.map((n) =>
      n.key === 'trigger_1'
        ? { ...n, config: { ...n.config, testInput: { city: 'Seoul' } } }
        : n,
    ),
  });

  const run = await page.request.post(`/api/workflows/${id}/runs`);
  expect(run.ok()).toBe(true);
  const { runId } = (await run.json()) as { runId: string };
  await expect
    .poll(
      async () =>
        (
          (await (
            await page.request.get(`/api/runs/${runId}/status`)
          ).json()) as { status: string }
        ).status,
      { timeout: 15_000 },
    )
    .toBe('SUCCESS');

  await page.goto('/');
  await expect(page.getByText('아침 기온 알림').first()).toBeVisible();
  await page.screenshot({ path: out('list') });

  await page.goto(`/w/${id}`);
  await expect(nodeByKey(page, 'notify_1')).toBeVisible();
  await selectNode(page, 'cond_1');
  await page.mouse.move(0, 0);
  await page.screenshot({ path: out('editor') });

  await page.goto(`/w/${id}/runs/${runId}`);
  await expect(
    page.getByRole('status').filter({ hasText: '성공' }),
  ).toBeVisible();
  await nodeByKey(page, 'msg_1').click();
  await expect(page.getByText('출력', { exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: out('run-detail') });
});
