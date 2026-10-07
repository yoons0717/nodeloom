'use client';

import { useMutation } from '@tanstack/react-query';
import type { Graph } from '@nodeloom/core';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/features/editor/store-context';
import { clientApi } from '@/lib/client-api';

type Saved = { name: string; graph: Graph; json: string };

const LEAVE_MESSAGE = '저장하지 않은 변경이 있습니다. 나갈까요?';

// 이름 편집, 저장 버튼, ⌘S, 저장 안 된 변경 표시(M3 작은 결정 ③④). 저장은 덮어쓰기다(DECISIONS 2-4).
export function SaveControls({
  id,
  initialName,
}: {
  id: string;
  initialName: string;
}) {
  const graph = useEditorStore((s) => s.graph);
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
    mutationFn: (body: { name: string; graph: Graph }) =>
      clientApi(`/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (_, body) => {
      setSaved({ ...body, json: JSON.stringify(body.graph) });
      setName(body.name);
    },
  });
  const canSave = dirty && !nameError && !save.isPending;
  const submit = () => {
    if (canSave) save.mutate({ name: trimmed, graph });
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
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const status = save.isPending
    ? '저장 중…'
    : save.error
      ? save.error.message
      : dirty
        ? '저장 안 된 변경'
        : '저장됨';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
        // 앱 안 이동은 beforeunload가 불리지 않아서 직접 묻는다.
        onClick={(e) => {
          if (dirty && !window.confirm(LEAVE_MESSAGE)) e.preventDefault();
        }}
      >
        ← 목록
      </Link>
      <Input
        aria-label="워크플로우 이름"
        aria-invalid={nameError ? true : undefined}
        title={nameError}
        className="h-9 w-56 font-bold"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button onClick={submit} disabled={!canSave}>
        저장
      </Button>
      <span
        role="status"
        className={`text-xs ${save.error ? 'text-destructive-text' : 'text-muted-foreground'}`}
      >
        {nameError ?? status}
      </span>
    </div>
  );
}
