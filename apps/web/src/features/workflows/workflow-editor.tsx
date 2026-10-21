'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MobileNavButton } from '@/components/app-sidebar/sidebar-shell';
import { buttonVariants } from '@/components/ui/button';
import { Editor, GraphIssueBadge } from '@/features/editor/editor';
import { RunControls } from '@/features/runs/run-controls';
import { minWidth } from '@/lib/media';
import { SaveControls } from './save-controls';
import type { Workflow } from './schemas';

export function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  // 좁은 화면에서는 에디터를 아예 그리지 않는다(DESIGN.md 반응형). 서버와 처음 그림이 같도록 마운트 뒤에 폭을 본다.
  const [mounted, setMounted] = useState(false);
  // 저장하지 않은 변경이 있으면 좁아져도 내리지 않는다(편집 내용 보호).
  const dirty = useRef(false);
  useEffect(() => {
    // md(768px) 이상에서만 편집한다(DESIGN.md 반응형).
    const mq = window.matchMedia(minWidth('md'));
    const update = () =>
      setMounted((on) => mq.matches || (on && dirty.current));
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <>
      {/* 좁은 화면에서는 편집 대신 안내만 보여 준다. 실행 기록과 설정은 좁은 화면에서도 쓸 수 있다. */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center md:hidden">
        <MobileNavButton className="absolute top-2 left-4" />
        <p className="font-bold">{workflow.name}</p>
        <p className="text-sm text-muted-foreground">
          에디터는 데스크톱처럼 넓은 화면에서 열어 주세요.
        </p>
        <div className="mt-3 flex w-full max-w-[280px] flex-col gap-2">
          <Link
            href={`/w/${workflow.id}/runs`}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            실행 기록 보기
          </Link>
          <Link
            href={`/w/${workflow.id}/settings`}
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}
          >
            설정
          </Link>
        </div>
      </div>
      <div className="hidden md:contents">
        {mounted && (
          <Editor
            initial={workflow.graph}
            toolbar={
              <SaveControls
                id={workflow.id}
                initialName={workflow.name}
                onDirtyChange={(d) => {
                  dirty.current = d;
                }}
                actions={<GraphIssueBadge />}
                after={(ensureSaved) => (
                  <RunControls
                    workflowId={workflow.id}
                    ensureSaved={ensureSaved}
                  />
                )}
              />
            }
          />
        )}
      </div>
    </>
  );
}
