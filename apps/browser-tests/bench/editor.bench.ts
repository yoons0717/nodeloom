import { type Page, test } from '@playwright/test';

type BenchResult = {
  nodeRenders: number;
  commits: number;
  commitMs: number;
  frames: number[];
};
type BenchApi = { start(): void; stop(): BenchResult };

const SIZES = [20, 200, 1000];
const RUNS = 3;

const bench = (page: Page) => ({
  start: () =>
    page.evaluate(() =>
      (window as unknown as { __bench: BenchApi }).__bench.start(),
    ),
  stop: () =>
    page.evaluate(() =>
      (window as unknown as { __bench: BenchApi }).__bench.stop(),
    ),
});

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};

// 캔버스 안에 통째로 보이는 노드 id. 노드가 많으면 화면 맞춤으로도 전부 보이지 않는다.
function visibleNodeIds(page: Page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left > pane.left + 60 &&
          r.right < pane.right - 60 &&
          r.top > pane.top + 60 &&
          r.bottom < pane.bottom - 60
        );
      })
      .map((el) => el.dataset.id!);
  });
}

const node = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"]`);

// 보이는 노드 하나를 잡고 300px 끌고 갔다가 제자리로 돌아와 놓는다. 반복해도 노드가 화면 밖으로 나가지 않는다.
async function drag(page: Page, ids: string[]) {
  const box = await node(page, ids[0]!).boundingBox();
  if (!box) throw new Error('끌 노드가 화면에 없습니다');
  const x = box.x + 20;
  const y = box.y + 20;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 300, y + 150, { steps: 30 });
  await page.mouse.move(x, y, { steps: 30 });
  await page.mouse.up();
}

// 보이는 노드 10개를 차례로 눌러 선택을 바꾼다.
async function select(page: Page, ids: string[]) {
  for (const id of ids.slice(1, 11)) {
    await node(page, id).click({ position: { x: 10, y: 10 } });
  }
}

const SCENARIOS = { 드래그: drag, '선택 변경 10회': select };
const rows: string[] = [];

for (const size of SIZES) {
  test(`노드 ${size}개`, async ({ page }) => {
    await page.goto(`/bench?nodes=${size}`);
    await page.locator('.react-flow__node').first().waitFor();
    await page.waitForTimeout(1000);
    const { start, stop } = bench(page);
    const ids = await visibleNodeIds(page);
    if (ids.length < 11)
      throw new Error(`보이는 노드가 ${ids.length}개뿐입니다`);

    for (const [name, run] of Object.entries(SCENARIOS)) {
      await run(page, ids); // 첫 실행은 준비 운동으로 버린다.
      const results: BenchResult[] = [];
      for (let r = 0; r < RUNS; r++) {
        await page.waitForTimeout(300);
        await start();
        await run(page, ids);
        await page.waitForTimeout(300);
        results.push(await stop());
      }
      const m = (f: (r: BenchResult) => number) => median(results.map(f));
      rows.push(
        `| ${size} | ${name} | ${m((r) => r.nodeRenders)} | ${m((r) => r.commits)} | ${m((r) => r.commitMs).toFixed(1)} | ${m((r) => percentile(r.frames, 0.5)).toFixed(1)} | ${m((r) => percentile(r.frames, 0.95)).toFixed(1)} | ${m((r) => Math.max(...r.frames)).toFixed(1)} |`,
      );
    }
  });
}

test.afterAll(() => {
  console.log(
    [
      '| 노드 수 | 동작 | 노드 리렌더 | 커밋 수 | 렌더 시간 합(ms) | 프레임 중앙값(ms) | 프레임 p95(ms) | 가장 긴 프레임(ms) |',
      '|---|---|---|---|---|---|---|---|',
      ...rows,
    ].join('\n'),
  );
});
