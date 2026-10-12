import { expect, type Page } from '@playwright/test';

// e2e 시나리오들이 함께 쓰는 에디터 조작.

export const nodes = (page: Page) => page.locator('.react-flow__node');
export const edges = (page: Page) => page.locator('.react-flow__edge');
// 카드에는 참조 키를 보여 주지 않으므로 카드의 data-key로 찾는다.
export const nodeByKey = (page: Page, key: string) =>
  page.locator(`.react-flow__node:has([data-key="${key}"])`);

export async function addNode(page: Page, label: string, x: number, y: number) {
  await page
    .getByRole('complementary', { name: '노드 목록' })
    .getByText(label, { exact: true })
    .dragTo(page.locator('.react-flow__pane'), { targetPosition: { x, y } });
}

// from 블록의 출력 점에서 to 블록의 입력 점으로 선을 끈다. 놓기 전에 확인할 일이 있으면 beforeDrop에서 한다.
// 출력이 여럿인 Condition은 'condition_1.true'처럼 포트를 붙인다.
export async function connect(
  page: Page,
  source: string,
  toKey: string,
  beforeDrop?: () => Promise<void>,
) {
  const [fromKey = source, port] = source.split('.');
  const from = await nodeByKey(page, fromKey)
    .locator(
      port
        ? `.react-flow__handle.source[data-handleid="${port}"]`
        : '.react-flow__handle.source',
    )
    .boundingBox();
  const to = await nodeByKey(page, toKey)
    .locator('.react-flow__handle.target')
    .boundingBox();
  if (!from || !to)
    throw new Error(`${fromKey} 또는 ${toKey}의 연결 점이 화면에 없습니다`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 10,
  });
  await beforeDrop?.();
  await page.mouse.up();
}

export async function selectNode(page: Page, key: string) {
  await nodeByKey(page, key).click({ position: { x: 12, y: 12 } });
}

export async function save(page: Page) {
  await page.keyboard.press('ControlOrMeta+s');
  await expect(
    page.getByRole('status').filter({ hasText: '저장됨' }),
  ).toBeVisible();
}
