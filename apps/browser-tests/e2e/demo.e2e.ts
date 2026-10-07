import { expect, test } from '@playwright/test';
import { addNode, nodes, save } from './editor.ts';

// 데모 모드: 로그인 없이 목록 → 새로 만들기 → 편집 → 저장(DECISIONS H-1, 6-5)
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
  await save(page);

  await page.reload();
  await expect(nodes(page)).toHaveCount(2);
});
