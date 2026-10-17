'use client';

import { Dialog } from '@base-ui/react/dialog';
import { isValidCron } from '@nodeloom/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import {
  describeSchedule,
  parseSchedule,
} from '@/features/editor/settings/schedule';
import { clientApi } from '@/lib/client-api';

type Target = { id: string; name: string; cron: string | null };

// 목록 ⋯ 메뉴와 설정 화면이 함께 쓰는 삭제 확인 창. 포커스는 "취소"에서 시작하고, Esc·바깥 클릭은 취소다.
export function DeleteWorkflowDialog({
  workflow,
  open,
  onOpenChange,
  onDeleted,
}: {
  workflow: Target;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const cancel = useRef<HTMLButtonElement>(null);
  const remove = useMutation({
    mutationFn: () =>
      clientApi(`/workflows/${workflow.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 사이드바 목록도 다시 불러온다(M6 6-g).
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onDeleted();
    },
  });
  // 지우는 중이거나 지운 뒤 이동하는 동안에는 닫지도 다시 누르지도 못하게 한다.
  const busy = remove.isPending || remove.isSuccess;
  const schedule =
    workflow.cron && isValidCron(workflow.cron)
      ? describeSchedule(parseSchedule(workflow.cron))
      : null;

  const change = (next: boolean) => {
    if (busy) return;
    if (!next) remove.reset();
    onOpenChange(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={change}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Popup
          role="alertdialog"
          initialFocus={cancel}
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-lg border border-border bg-popover p-5 shadow-help outline-none"
        >
          <Dialog.Title className="text-base font-bold">
            &apos;{workflow.name}&apos;{objectParticle(workflow.name)}{' '}
            삭제할까요?
          </Dialog.Title>
          <Dialog.Description className="text-body-sm text-label">
            {schedule
              ? `되돌릴 수 없습니다. 실행 기록도 함께 지워지고, ${schedule} 스케줄도 멈춥니다.`
              : '되돌릴 수 없습니다. 실행 기록도 함께 지워집니다.'}
          </Dialog.Description>
          {/* 어떤 워크플로우가 이것을 실패 시 실행하는지는 목록 데이터로 알 수 없어 늘 안내한다. */}
          <p className="text-xs text-muted-foreground">
            실패 시 이 워크플로우를 실행하도록 한 설정이 있으면
            &apos;없음&apos;이 됩니다.
          </p>
          {remove.error && (
            <InlineError role="alert" message={remove.error.message} />
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              ref={cancel}
              variant="outline"
              disabled={busy}
              onClick={() => change(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="bg-danger-strong font-bold text-foreground disabled:text-foreground"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              {busy ? '삭제 중…' : '삭제'}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// 설정 화면 맨 아래 구역. 지우면 목록으로 옮긴다. 지운 화면을 다시 그리지 않도록 refresh 대신 replace로 간다.
export function DeleteWorkflowSection({ workflow }: { workflow: Target }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-danger-soft bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">워크플로우 삭제</h2>
        <p className="text-body-sm text-label">
          워크플로우와 실행 기록을 지웁니다. 되돌릴 수 없습니다.
        </p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 />
        삭제
      </Button>
      <DeleteWorkflowDialog
        workflow={workflow}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => router.replace('/')}
      />
    </section>
  );
}

// 이름 끝 글자에 받침이 있으면 '을', 없으면 '를'. 끝이 한글이 아니면 '을(를)'.
export function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return '을(를)';
  return code % 28 ? '을' : '를';
}
