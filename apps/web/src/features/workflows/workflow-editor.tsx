'use client';

import Link from 'next/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Editor,
  GraphIssueBadge,
  TopBarDivider,
  UndoRedo,
} from '@/features/editor/editor';
import { RunControls } from '@/features/runs/run-controls';
import { FailureWorkflowSelect } from './failure-workflow-select';
import { SaveControls } from './save-controls';
import type { Workflow } from './schemas';

export function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  return (
    <>
      {/* 좁은 화면에서는 편집 대신 안내만 보여 준다(DECISIONS B-11). 실행 기록은 읽기 화면이라 볼 수 있다. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center md:hidden">
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
              middle={
                <>
                  <TopBarDivider />
                  <UndoRedo />
                </>
              }
              actions={
                <>
                  <GraphIssueBadge />
                  <Button
                    variant="ghost"
                    render={<Link href={`/w/${workflow.id}/runs`} />}
                    nativeButton={false}
                  >
                    실행 기록
                  </Button>
                  <Popover>
                    <PopoverTrigger render={<Button variant="ghost" />}>
                      설정
                    </PopoverTrigger>
                    <PopoverContent>
                      <FailureWorkflowSelect
                        workflowId={workflow.id}
                        initial={workflow.failureWorkflowId}
                      />
                    </PopoverContent>
                  </Popover>
                  <TopBarDivider />
                </>
              }
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
