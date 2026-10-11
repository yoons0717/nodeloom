// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGraph } from '../commands';
import { SettingsPanel } from '../settings-panel';
import { EditorStoreProvider, useEditorStore } from '../store-context';

beforeEach(() => {
  // 서울 2026-10-11 09:00
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function SelectTrigger() {
  const graph = useEditorStore((s) => s.graph);
  const setSelection = useEditorStore((s) => s.setSelection);
  const id = graph.nodes.find((n) => n.type === 'trigger')!.id;
  useEffect(
    () => setSelection({ nodeIds: [id], edgeIds: [] }),
    [setSelection, id],
  );
  return null;
}

function renderTrigger(role: 'admin' | 'demo', cron: string | null = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ role }))),
  );
  const graph = createInitialGraph();
  graph.nodes[0]!.config = { cron };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditorStoreProvider initial={graph}>
        <SelectTrigger />
        <SettingsPanel />
      </EditorStoreProvider>
    </QueryClientProvider>,
  );
}

async function choose(label: string, option: string) {
  fireEvent.click(screen.getByLabelText(label));
  // Base UI Select 항목은 pointerdown 없이 click만 오면 고르지 않는다.
  const item = await screen.findByRole('option', { name: option });
  fireEvent.pointerDown(item);
  fireEvent.click(item);
}

const nextRuns = async () =>
  (await screen.findAllByRole('listitem')).map((li) => li.textContent);

describe('Trigger 설정', () => {
  it('평일을 고르고 시각을 넣으면 평일 그 시각이 다음 실행으로 보인다', async () => {
    renderTrigger('admin');
    expect(screen.queryByText('다음 실행')).toBeNull();

    await choose('반복', '평일(월~금)');
    fireEvent.change(screen.getByLabelText('시각'), {
      target: { value: '08:30' },
    });
    // 오늘은 일요일이라 월·화·수
    expect(await nextRuns()).toEqual([
      expect.stringMatching(/10\. 12\. 08:30$/),
      expect.stringMatching(/10\. 13\. 08:30$/),
      expect.stringMatching(/10\. 14\. 08:30$/),
    ]);
  });

  it('저장된 cron이 선택지에 맞으면 그 선택지로, 아니면 직접 입력으로 보여 준다', () => {
    renderTrigger('admin', '0 7 * * 6');
    expect(screen.getByLabelText('반복').textContent).toContain('매주');
    expect(screen.getByLabelText('요일').textContent).toContain('토요일');
    expect(screen.getByLabelText<HTMLInputElement>('시각').value).toBe('07:00');
    cleanup();

    renderTrigger('admin', '*/15 9-18 * * 1-5');
    expect(screen.getByLabelText('반복').textContent).toContain('직접 입력');
    expect(screen.getByLabelText<HTMLInputElement>('cron').value).toBe(
      '*/15 9-18 * * 1-5',
    );
  });

  it('직접 입력에서 틀린 cron이면 오류를 보여 주고 다음 실행은 감춘다', async () => {
    renderTrigger('admin');
    await choose('반복', '직접 입력 (cron)');
    const cron = screen.getByLabelText('cron');
    // 고르기만 하고 아직 입력하지 않았으면 오류가 아니다.
    expect(screen.queryByText(/cron 식이 올바르지 않습니다/)).toBeNull();

    // 선택지와 같은 모양이어도 직접 입력 칸이 그대로 남는다.
    fireEvent.change(cron, { target: { value: '0 7 * * *' } });
    expect(screen.getByLabelText('cron')).toBe(cron);
    expect(await nextRuns()).toHaveLength(3);

    for (const bad of ['0 25 * * *', '0 0 7 * * *']) {
      fireEvent.change(cron, { target: { value: bad } });
      expect(screen.getByText(/cron 식이 올바르지 않습니다/)).toBeTruthy();
      expect(screen.queryByText('다음 실행')).toBeNull();
    }
  });

  it('데모 서버에서는 다음 실행 시각 대신 실행되지 않는다고 알린다', async () => {
    renderTrigger('demo', '0 7 * * *');
    expect(
      await screen.findByText('데모에서는 스케줄이 실행되지 않습니다'),
    ).toBeTruthy();
    expect(screen.queryByText('다음 실행')).toBeNull();
  });
});
