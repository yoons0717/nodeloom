import { expect, test } from '@playwright/test';
import { API_PORT } from './config.ts';
import {
  addNode,
  connect,
  nodeByKey,
  nodes,
  save,
  selectNode,
} from './editor.ts';

// 데모 모드: 로그인 없이 목록 → 새로 만들기 → 편집 → 저장 → 실행(DECISIONS H-1, 6-5)
// 데모에서는 연습용 주소(/mock)로만 요청할 수 있다(DECISIONS 1-3).
test('데모 모드에서는 로그인 없이 편집하고 저장할 수 있다', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('데모', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '로그아웃' })).toHaveCount(0);

  await page.getByRole('button', { name: '새로 만들기' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  await addNode(page, 'HTTP', 500, 250);
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
  await addNode(page, 'HTTP', 500, 250);
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
  // 성공한 노드는 ✓와 걸린 시간을 보여 준다.
  await expect(nodes(page).filter({ hasText: '✓' })).toHaveCount(2);

  await nodeByKey(page, 'http_1').click();
  await expect(page.getByText('출력', { exact: true })).toBeVisible();
});

// Transform → Condition 분기: 고른 갈래만 실행하고 다른 갈래는 건너뛴다(M4 흐름 판정을 화면에서)
test('Condition이 고른 갈래만 실행되고, 상세 화면에서 고른 쪽과 건너뛴 쪽이 보인다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새로 만들기' }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
  await addNode(page, 'Transform', 250, 250);
  await addNode(page, 'Condition', 430, 250);
  await addNode(page, 'Transform', 620, 120);
  await addNode(page, 'Transform', 620, 420);
  await connect(page, 'trigger_1', 'transform_1');
  await connect(page, 'transform_1', 'condition_1');
  await connect(page, 'condition_1.true', 'transform_2');
  await connect(page, 'condition_1.false', 'transform_3');

  await selectNode(page, 'transform_1');
  await page.getByLabel('변환 식', { exact: true }).fill('{ "n": 5 }');
  await selectNode(page, 'condition_1');
  await page.getByLabel('조건 식', { exact: true }).fill('n > 3');
  await selectNode(page, 'transform_2');
  await page.getByLabel('변환 식', { exact: true }).fill('"크다"');
  await selectNode(page, 'transform_3');
  await page.getByLabel('변환 식', { exact: true }).fill('"작다"');
  await save(page);

  await page.getByRole('button', { name: '실행', exact: true }).click();
  await page.getByRole('link', { name: '결과 보기' }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+$/);
  await expect(
    page.getByRole('status').filter({ hasText: '성공' }),
  ).toBeVisible({ timeout: 15_000 });

  await expect(nodeByKey(page, 'condition_1')).toContainText('참 ●');
  await expect(nodeByKey(page, 'transform_2')).toContainText('✓');
  await expect(nodeByKey(page, 'transform_3')).toContainText('건너뜀');
  // 안 간 갈래(거짓 → transform_3)만 점선이다.
  await expect(
    page.locator('.react-flow__edge-path[style*="stroke-dasharray"]'),
  ).toHaveCount(1);

  await nodeByKey(page, 'transform_2').click();
  // 출력 패널의 JSON 보기(값은 눌러서 고를 수 있는 버튼)
  await expect(page.getByRole('button', { name: '"크다"' })).toBeVisible();
});

// 태블릿 세로(768): 팔레트는 레일, 설정 패널은 캔버스 위에 겹쳐 열린다(DESIGN.md 반응형).
test.describe('768px 간단 배치', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('팔레트 레일로 노드를 추가하면 설정 패널이 겹쳐 열리고 Esc로 닫힌다', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '새로 만들기' }).click();
    await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);
    await expect(nodes(page)).toHaveCount(1);

    await page
      .getByRole('complementary', { name: '노드 목록' })
      .getByRole('button', { name: 'HTTP', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'HTTP' })
      .getByRole('button', { name: /캔버스에 추가/ })
      .click();
    await expect(nodes(page)).toHaveCount(2);

    const panel = page.getByRole('complementary', { name: '노드 설정' });
    await expect(
      panel.getByRole('heading', { name: 'HTTP 요청' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    await save(page);
  });
});
