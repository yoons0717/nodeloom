'use client';

import { Menu } from '@base-ui/react/menu';
import { Ellipsis, History, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteWorkflowDialog } from './delete-workflow-dialog';

const item =
  'flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-body-sm outline-none select-none data-highlighted:bg-raised-hover pointer-coarse:min-h-11 [&_svg]:size-3.5';

// 목록 행의 ⋯ 메뉴. 행을 누르면 이미 편집으로 가므로 "편집 열기"는 넣지 않는다.
export function WorkflowRowMenu({
  workflow,
}: {
  workflow: { id: string; name: string; cron: string | null };
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-md"
              aria-label={`${workflow.name} 메뉴`}
              className="text-muted-foreground pointer-coarse:size-11"
            />
          }
        >
          <Ellipsis />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="isolate z-50">
            <Menu.Popup className="flex min-w-44 flex-col rounded-lg border border-border bg-popover p-1 shadow-md outline-none">
              <Menu.LinkItem
                className={item}
                render={<Link href={`/w/${workflow.id}/runs`} />}
              >
                <History />
                실행 기록
              </Menu.LinkItem>
              <Menu.LinkItem
                className={item}
                render={<Link href={`/w/${workflow.id}/settings`} />}
              >
                <Settings />
                설정
              </Menu.LinkItem>
              <Menu.Separator className="my-1 h-px bg-border-subtle" />
              <Menu.Item
                className={`${item} text-danger-text data-highlighted:bg-danger-soft`}
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
                삭제
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <DeleteWorkflowDialog
        workflow={workflow}
        open={confirming}
        onOpenChange={setConfirming}
        // 창은 닫지 않고 "삭제 중…"으로 두었다가, 새로 그린 목록에서 행이 빠질 때 함께 사라진다.
        onDeleted={() => router.refresh()}
      />
    </>
  );
}
