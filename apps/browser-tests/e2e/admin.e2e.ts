import { expect, test } from '@playwright/test';
import { E2E_PASSWORD } from './config.ts';
import { addNode, connect, edges, nodes, save, selectNode } from './editor.ts';

// 관리자: 로그인 → 노드 추가 → 연결 → 순환 연결 거부 → Undo → 저장 → 새로고침 후 복원(DECISIONS H-1)
test('로그인해서 만든 흐름은 저장 후 새로고침해도 그대로 복원된다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('비밀번호').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('heading', { name: 'Nodeloom' })).toBeVisible();

  await page.getByRole('button', { name: '새로 만들기' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  await expect(nodes(page)).toHaveCount(1);

  await addNode(page, 'HTTP 요청', 300, 250);
  await addNode(page, 'Transform', 550, 250);
  await connect(page, 'trigger_1', 'http_1');
  await connect(page, 'http_1', 'transform_1');
  await expect(edges(page)).toHaveCount(2);

  // 되돌아오는 연결은 끄는 동안 이유를 보여 주고, 놓아도 생기지 않는다.
  await connect(page, 'transform_1', 'http_1', async () => {
    await expect(
      page.getByText('이 연결을 만들면 순환이 생깁니다'),
    ).toBeVisible();
  });
  await expect(edges(page)).toHaveCount(2);

  // Undo: 마지막 연결(http_1 → transform_1)이 사라진다.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(edges(page)).toHaveCount(1);

  // 입력 칸에서 Backspace를 눌러도 노드가 지워지지 않는다(M2 위험 대응).
  await selectNode(page, 'http_1');
  await page.getByLabel('제목').press('Backspace');
  await expect(nodes(page)).toHaveCount(3);

  await save(page);
  await page.reload();
  await expect(nodes(page)).toHaveCount(3);
  await expect(edges(page)).toHaveCount(1);
  await expect(
    page.getByRole('status').filter({ hasText: '저장됨' }),
  ).toBeVisible();
});
