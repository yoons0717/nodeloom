'use client';

import Link from 'next/link';
import { MobileNavButton } from '@/components/app-sidebar/sidebar-shell';
import { Editor, GraphIssueBadge } from '@/features/editor/editor';
import { RunControls } from '@/features/runs/run-controls';
import { SaveControls } from './save-controls';
import type { Workflow } from './schemas';

export function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  return (
    <>
      {/* 좁은 화면에서는 편집 대신 안내만 보여 준다(DECISIONS B-11). 실행 기록은 읽기 화면이라 볼 수 있다. */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center md:hidden">
        <MobileNavButton className="absolute top-2 left-4" />
        <p className="font-bold">{workflow.name}</p>
        <p className="text-sm text-muted-foreground">
          에디터는 데스크톱처럼 넓은 화면에서 열어 주세요.
        </p>
        <Link
          href={`/w/${workflow.id}/runs`}
          className="text-sm text-accent hover:underline"
        >
          실행 기록 보기
        </Link>
      </div>
      <div className="hidden md:contents">
        <Editor
          initial={workflow.graph}
          toolbar={
            <SaveControls
              id={workflow.id}
              initialName={workflow.name}
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
      </div>
    </>
  );
}
