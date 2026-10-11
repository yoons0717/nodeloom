import { expect, test } from '@playwright/test';
import { API_PORT } from './config.ts';
import { addNode, connect, nodes, save, selectNode } from './editor.ts';

// 데모 모드: 로그인 없이 목록 → 새로 만들기 → 편집 → 저장 → 실행(DECISIONS H-1, 6-5)
// 데모에서는 연습용 주소(/mock)로만 요청할 수 있다(DECISIONS 1-3).
test('데모 모드에서는 로그인 없이 편집하고 저장할 수 있다', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText('데모 · 로그인 없이 누구나 편집할 수 있습니다'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '로그아웃' })).toHaveCount(0);

  await page.getByRole('button', { name: '새로 만들기' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  await addNode(page, 'HTTP 요청', 500, 250);
  await connect(page, 'trigger_1', 'http_1');
  await selectNode(page, 'http_1');
  await page
    .getByLabel('URL')
    .fill(`http://localhost:${API_PORT}/mock/weather`);
  await save(page);

  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '실행 성공' }),
  ).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(nodes(page)).toHaveCount(2);
});

// 실행 → 결과 보기 → 상세 화면에서 노드별 상태와 입출력 확인(M5)
test('실행하면 상세 화면에서 노드별 상태와 입출력을 볼 수 있다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새로 만들기' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  await addNode(page, 'HTTP 요청', 500, 250);
  await connect(page, 'trigger_1', 'http_1');
  await selectNode(page, 'http_1');
  await page
    .getByLabel('URL')
    .fill(`http://localhost:${API_PORT}/mock/weather`);
  await save(page);

  await page.getByRole('button', { name: '실행', exact: true }).click();
  await page.getByRole('link', { name: '결과 보기' }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+$/);
  // 진행 중이면 상세 화면이 1초마다 상태를 이어서 조회한다.
  await expect(
    page.getByRole('status').filter({ hasText: '성공' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(nodes(page).filter({ hasText: '성공' })).toHaveCount(2);

  await nodes(page).filter({ hasText: 'http_1' }).click();
  await expect(page.getByText('출력', { exact: true })).toBeVisible();
});
