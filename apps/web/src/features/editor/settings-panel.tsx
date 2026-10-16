'use client';

import type { GraphNode, NodeType } from '@nodeloom/core';
import { type ComponentType, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isAtLeast } from '@/lib/media';
import { cn } from '@/lib/utils';
import { renameNode, updateConfig } from './commands';
import { getGraphIssues } from './graph-issues';
import { NodeGlyph } from './node-glyph';
import { NODE_META, PORT_LABEL } from './node-meta';
import { ConditionSettings } from './settings/condition-settings';
import { Field, type SettingsProps } from './settings/field';
import { HttpSettings } from './settings/http-settings';
import { TransformSettings } from './settings/transform-settings';
import { TriggerSettings } from './settings/trigger-settings';
import { useEditorStore } from './store-context';

// 노드 종류마다 직접 만든 설정 화면(M2 작은 결정 ②).
const SETTINGS: Record<NodeType, ComponentType<SettingsProps>> = {
  trigger: TriggerSettings,
  http: HttpSettings,
  transform: TransformSettings,
  condition: ConditionSettings,
};

// xl 이상은 캔버스 오른쪽에 나란히(320). md – lg는 노드를 고르면 캔버스 위 오른쪽에 겹쳐 연다(DESIGN.md 반응형).
// 겹친 패널은 모달이 아니라 열려 있어도 캔버스를 움직일 수 있고, 선택 해제·닫기 버튼·Esc로 닫힌다.
export function SettingsPanel() {
  const graph = useEditorStore((s) => s.graph);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  // 노드를 정확히 하나 골랐을 때만 설정을 보여 준다.
  const node =
    selection.nodeIds.length === 1
      ? graph.nodes.find((n) => n.id === selection.nodeIds[0])
      : undefined;
  const open = node !== undefined;
  const close = useCallback(
    () => setSelection({ nodeIds: [], edgeIds: [] }),
    [setSelection],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // 도움말·선택 목록 같은 떠 있는 부품 안의 Esc는 그 부품만 닫는다.
      const inPopup = (e.target as Element | null)?.closest?.(
        '[role="dialog"], [role="listbox"], [role="menu"]',
      );
      if (e.key !== 'Escape' || isAtLeast('xl') || inPopup) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <aside
      aria-label="노드 설정"
      data-help-edge
      className={cn(
        'flex w-80 shrink-0 flex-col bg-surface xl:border-l xl:border-border-subtle',
        'max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:border-l max-xl:border-help-border max-xl:shadow-panel',
        !open && 'max-xl:hidden',
      )}
    >
      {node ? (
        <ScrollArea className="min-h-0 flex-1">
          {/* 노드가 바뀌면 입력 중이던 내용을 버리고 새로 그린다. */}
          <NodeSettings key={node.id} node={node} onClose={close} />
        </ScrollArea>
      ) : (
        <p className="p-4 text-xs text-muted-foreground">
          노드를 하나 선택하면 설정이 여기에 보입니다
        </p>
      )}
    </aside>
  );
}

function NodeSettings({
  node,
  onClose,
}: {
  node: GraphNode;
  onClose: () => void;
}) {
  const graph = useEditorStore((s) => s.graph);
  const execute = useEditorStore((s) => s.execute);
  const issues = getGraphIssues(graph).byNode.get(node.id) ?? [];

  // 칸마다 첫 오류 하나. 칸에 붙지 않는 문제(연결 끊김, 순환 등)는 위에 모아 보여 준다.
  const errors: Record<string, string> = {};
  for (const i of issues) if (i.field) errors[i.field] ??= i.message;
  const nodeIssues = issues.filter((i) => !i.field);

  const Settings = SETTINGS[node.type];
  const meta = NODE_META[node.type];
  return (
    <>
      {/* 머리: 종류, 제목, 다른 노드에서 읽는 이름. 참조 키는 카드 대신 여기에 보인다. */}
      <div className="flex flex-col gap-2 border-b border-border-subtle p-4">
        <div className="flex items-center">
          <span
            className={`flex h-6 w-fit items-center gap-1.5 rounded-md pr-2 pl-1 text-xs font-medium ${meta.chipClass}`}
          >
            <span aria-hidden className="w-4 text-center">
              {meta.glyph}
            </span>
            {meta.label}
          </span>
          {/* 겹쳐 연 패널(md – lg)에서만 보인다. */}
          <button
            type="button"
            aria-label="설정 닫기"
            onClick={onClose}
            className="-m-2.5 ml-auto flex size-11 items-center justify-center rounded-md text-lg text-muted-foreground outline-none hover:bg-raised-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-accent-ring xl:hidden"
          >
            ×
          </button>
        </div>
        <h2 className="truncate text-base font-bold">{node.title}</h2>
        <p className="font-mono text-xs text-muted-foreground">
          $nodes.{node.key}
        </p>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {nodeIssues.length > 0 && (
          <ul role="status" className="flex flex-col items-start gap-1">
            {nodeIssues.map((i) => (
              <li key={i.code}>
                {/* 문구가 길어 패널 너비를 넘으면 줄을 바꾼다. */}
                <Badge
                  tone="danger"
                  className="h-auto py-0.5 whitespace-normal"
                >
                  {i.message}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Field label="제목" error={errors.title}>
          {(control) => (
            <Input
              {...control}
              value={node.title}
              onChange={(e) =>
                execute(renameNode(graph, node.id, 'title', e.target.value))
              }
            />
          )}
        </Field>
        <Field
          label="참조 키"
          hint="다른 노드의 식에서 이 이름으로 결과를 읽습니다"
          error={errors.key}
        >
          {(control) => (
            <Input
              {...control}
              spellCheck={false}
              className="font-mono text-body-sm"
              value={node.key}
              onChange={(e) =>
                execute(renameNode(graph, node.id, 'key', e.target.value))
              }
            />
          )}
        </Field>
        <Settings
          node={node}
          errors={errors}
          set={(field, value) =>
            execute(updateConfig(graph, node.id, field, value))
          }
        />
        {node.type === 'condition' && <Branches node={node} />}
      </div>
    </>
  );
}

// Condition의 참·거짓 포트가 어느 노드로 이어지는지. 캔버스를 따라가지 않고도 갈래를 확인한다.
function Branches({ node }: { node: GraphNode }) {
  const graph = useEditorStore((s) => s.graph);
  const targets = (port: string) =>
    graph.edges
      .filter((e) => e.from.node === node.id && e.from.port === port)
      .map((e) => graph.nodes.find((n) => n.id === e.to.node))
      .filter((n) => n !== undefined);

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
      <span className="text-xs font-medium text-label">분기</span>
      {(['true', 'false'] as const).map((port) => {
        const list = targets(port);
        return (
          <div
            key={port}
            className="flex min-h-9 items-center gap-2 rounded-md bg-raised px-3 py-2 text-body-sm"
          >
            <span className="w-8 shrink-0 text-muted-foreground">
              {PORT_LABEL[port]}
            </span>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            {list.length === 0 ? (
              <span className="text-muted-foreground">연결 안 됨</span>
            ) : (
              <span className="flex min-w-0 flex-col gap-1">
                {list.map((t) => (
                  <span key={t.id} className="flex min-w-0 items-center gap-2">
                    <NodeGlyph type={t.type} />
                    <span className="truncate">{t.title}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
