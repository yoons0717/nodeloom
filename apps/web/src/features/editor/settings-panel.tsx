'use client';

import type { GraphNode, NodeType } from '@nodeloom/core';
import type { ComponentType } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { renameNode, updateConfig } from './commands';
import { getGraphIssues } from './graph-issues';
import { NODE_META } from './node-meta';
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

export function SettingsPanel() {
  const graph = useEditorStore((s) => s.graph);
  const selection = useEditorStore((s) => s.selection);
  // 노드를 정확히 하나 골랐을 때만 설정을 보여 준다.
  const node =
    selection.nodeIds.length === 1
      ? graph.nodes.find((n) => n.id === selection.nodeIds[0])
      : undefined;

  return (
    <aside
      aria-label="노드 설정"
      className="flex w-80 shrink-0 flex-col border-l border-divider bg-surface"
    >
      {node ? (
        <ScrollArea className="min-h-0 flex-1">
          {/* 노드가 바뀌면 입력 중이던 내용을 버리고 새로 그린다. */}
          <NodeSettings key={node.id} node={node} />
        </ScrollArea>
      ) : (
        <p className="p-4 text-xs text-muted-foreground">
          노드를 하나 선택하면 설정이 여기에 보입니다
        </p>
      )}
    </aside>
  );
}

function NodeSettings({ node }: { node: GraphNode }) {
  const graph = useEditorStore((s) => s.graph);
  const execute = useEditorStore((s) => s.execute);
  const issues = getGraphIssues(graph).byNode.get(node.id) ?? [];

  // 칸마다 첫 오류 하나. 칸에 붙지 않는 문제(연결 끊김, 순환 등)는 위에 모아 보여 준다.
  const errors: Record<string, string> = {};
  for (const i of issues) if (i.field) errors[i.field] ??= i.message;
  const nodeIssues = issues.filter((i) => !i.field);

  const Settings = SETTINGS[node.type];
  return (
    <div className="flex flex-col gap-3.5 p-4">
      <h2 className="text-xs font-bold text-muted-foreground">
        {NODE_META[node.type].label} 설정
      </h2>
      {nodeIssues.length > 0 && (
        <ul role="status" className="flex flex-col gap-1">
          {nodeIssues.map((i) => (
            <li
              key={i.code}
              className="rounded-lg bg-destructive-soft px-2.5 py-1.5 text-xs text-destructive-text"
            >
              {i.message}
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
        hint="다른 노드의 식에서 $nodes.<참조 키>로 이 노드의 결과를 읽습니다"
        error={errors.key}
      >
        {(control) => (
          <Input
            {...control}
            spellCheck={false}
            className="font-mono text-[13px]"
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
    </div>
  );
}
