'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Graph } from '@nodeloom/core';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { MobileNavButton } from '@/components/app-sidebar/sidebar-shell';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/features/editor/store-context';
import { ApiError, clientApi } from '@/lib/client-api';

type Body = { name: string; graph: Graph };
type Saved = Body & { json: string };

const LEAVE_MESSAGE =
  '저장하지 않은 변경 사항이 있습니다. 이 페이지를 나갈까요?';

// 이름 편집, 저장 상태 칩, ⌘S(M3 작은 결정 ③④). 저장은 덮어쓰기다(DECISIONS 2-4).
// 상단 바 한 줄을 이룬다: 왼쪽(이름 · 저장 상태 칩), 오른쪽(actions · after).
// 저장 버튼은 따로 두지 않고, 바뀐 것이 있을 때 상태 칩 안에 나타난다(M6 6-h, 시안 1b).
// actions: 오른쪽 앞 요소(문제 배지). after: 실행 버튼. 실행 전에 저장하도록 ensureSaved를 넘긴다.
export function SaveControls({
  id,
  initialName,
  actions,
  after,
}: {
  id: string;
  initialName: string;
  actions?: ReactNode;
  after?: (ensureSaved: () => Promise<boolean>) => ReactNode;
}) {
  const graph = useEditorStore((s) => s.graph);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState<Saved>(() => ({
    name: initialName,
    graph,
    json: JSON.stringify(graph),
  }));

  // 그래프는 바뀔 때마다 새 객체라 객체가 같으면 바로 "변경 없음"이다. 다르면 내용을 비교한다(Undo로 저장한 상태에 돌아온 경우).
  const graphChanged = useMemo(
    () => graph !== saved.graph && JSON.stringify(graph) !== saved.json,
    [graph, saved],
  );
  const trimmed = name.trim();
  const nameError =
    trimmed.length === 0
      ? '이름을 입력하세요'
      : trimmed.length > 100
        ? '이름은 100자까지 쓸 수 있습니다'
        : undefined;
  const dirty = graphChanged || trimmed !== saved.name;

  const save = useMutation({
    mutationFn: (body: Body) =>
      clientApi(`/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (_, body) => {
      // 이름이 바뀌었을 수 있으니 사이드바 목록을 다시 불러온다(M6 6-g).
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      // 이름 칸은 건드리지 않는다. 저장하는 동안 이어서 입력한 글자가 지워지지 않게.
      setSaved({ ...body, json: JSON.stringify(body.graph) });
    },
  });
  // 진행 중인 저장. 실행이 저장을 기다릴 때 같은 내용을 한 번 더 보내지 않게 한다.
  const [inflight, setInflight] = useState<{
    body: Body;
    done: Promise<unknown>;
  } | null>(null);
  const send = (body: Body) => {
    const done = save.mutateAsync(body);
    setInflight({ body, done });
    return done;
  };
  const canSave = dirty && !nameError && !save.isPending;
  const submit = () => {
    // 실패 사유는 save.error로 저장 상태 칸에 나온다.
    if (canSave) send({ name: trimmed, graph }).catch(() => {});
  };
  // 저장할 것이 없으면 바로 true. 저장에 실패하면 false이고 사유는 저장 상태 칸에 나온다.
  const ensureSaved = async () => {
    if (!dirty) return true;
    if (nameError) return false;
    try {
      const current = save.isPending ? inflight : null;
      if (current) {
        await current.done;
        // 기다린 저장이 지금 내용 그대로면 끝. 그사이 바뀌었으면 이어서 한 번 더 저장한다.
        if (current.body.name === trimmed && current.body.graph === graph)
          return true;
      }
      await send({ name: trimmed, graph });
      return true;
    } catch {
      return false;
    }
  };

  // ⌘S / Ctrl+S. 입력 칸 안에서도 저장한다(브라우저의 "페이지 저장"을 막음).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // 새로고침, 탭 닫기, 주소 이동 전에 확인한다.
  // 앱 안 이동(사이드바 링크 등)은 beforeunload가 불리지 않아서 링크 클릭을 먼저 가로채 묻는다.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest('a[href]');
      const href = a?.getAttribute('href');
      if (!href?.startsWith('/') || href === window.location.pathname) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  // 여기서 로그인 화면으로 가면 편집 중인 그래프를 잃는다. 쿠키는 탭끼리 같이 쓰므로 다른 탭에서 로그인하면 된다.
  const saveError =
    save.error instanceof ApiError && save.error.status === 401
      ? '로그인이 만료되었습니다. 다른 탭에서 로그인한 뒤 다시 저장하세요'
      : save.error?.message;

  return (
    <>
      <MobileNavButton />
      {/* 글자처럼 보이다가 누르면 편집한다(M6 작은 결정 ⑩). */}
      <Input
        aria-label="워크플로우 이름"
        aria-invalid={nameError ? true : undefined}
        title={nameError}
        className="field-sizing-content h-9 w-auto max-w-72 min-w-24 border-transparent bg-transparent text-base font-bold hover:border-border-control"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <SaveStatus
        nameError={nameError}
        pending={save.isPending}
        error={saveError}
        dirty={dirty}
        onSave={submit}
      />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {actions}
        {after?.(ensureSaved)}
      </div>
    </>
  );
}

const CHIP =
  'flex h-7 shrink-0 items-center gap-2 rounded-full pr-1 pl-2.5 text-xs font-medium';
const CHIP_BUTTON =
  'flex h-[22px] items-center gap-1.5 rounded-full px-2 font-bold outline-none focus-visible:ring-3 focus-visible:ring-accent-ring';

// 저장 상태가 곧 저장 버튼이다. 저장됨은 화면에 보이지 않고(스크린 리더에만), 바뀌면 칩 안에 저장 버튼, 실패하면 빨간 칩에 다시 시도.
// 긴 실패 사유(로그인 만료 안내)는 칩에 넣지 않고 툴팁과 스크린 리더 글자로 둔다.
function SaveStatus({
  nameError,
  pending,
  error,
  dirty,
  onSave,
}: {
  nameError: string | undefined;
  pending: boolean;
  error: string | undefined;
  dirty: boolean;
  onSave: () => void;
}) {
  if (nameError)
    return (
      <span role="status" className="shrink-0 text-xs text-danger-text">
        {nameError}
      </span>
    );
  if (pending)
    return (
      <span role="status" className="shrink-0 text-xs text-muted-foreground">
        저장 중…
      </span>
    );
  if (error)
    return (
      <span title={error} className={`${CHIP} bg-danger-soft text-danger-text`}>
        <span aria-hidden>!</span>
        <span role="status" className="-ml-1">
          저장 실패<span className="sr-only"> · {error}</span>
        </span>
        <button
          type="button"
          onClick={onSave}
          className={`${CHIP_BUTTON} border border-danger-text`}
        >
          다시 시도
        </button>
      </span>
    );
  if (dirty)
    return (
      <span className={`${CHIP} bg-warning-soft text-warning-text`}>
        <span aria-hidden>●</span>
        <span role="status" className="-ml-1">
          저장 안 됨
        </span>
        <button
          type="button"
          aria-label="저장"
          onClick={onSave}
          className={`${CHIP_BUTTON} bg-warning text-bg`}
        >
          저장
          <kbd className="font-mono text-caption font-medium">⌘S</kbd>
        </button>
      </span>
    );
  return (
    <span role="status" className="sr-only">
      저장됨
    </span>
  );
}
