'use client';

import { type GraphNode, NODE_SPECS } from '@nodeloom/core';
import { type ReactNode, useId } from 'react';

// 설정 화면이 공통으로 받는 값. 오류는 칸 이름 → 문구(칸마다 첫 오류 하나).
export type SettingsProps = {
  node: GraphNode;
  errors: Record<string, string>;
  set: (field: string, value: unknown) => void;
};

type Schema = { safeParse: (v: unknown) => { data?: unknown } };

// 아직 저장되지 않은 칸은 core 스키마의 기본값을 보여 준다. 기본값을 여기에 따로 적지 않는다.
export function configDefault(node: GraphNode, field: string): unknown {
  const shape = NODE_SPECS[node.type].config.shape as Record<string, Schema>;
  return shape[field]?.safeParse(undefined).data;
}

export function configValue(node: GraphNode, field: string): unknown {
  return node.config[field] ?? configDefault(node, field);
}

export type FieldControlProps = {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

// 라벨, 입력 부품, 오류 문구를 묶는다. 입력 부품에 붙일 id와 오류 상태(aria-invalid)를 넘겨준다.
// group: 입력 부품이 여럿인 묶음(쿼리·헤더). 라벨은 묶음의 이름이 되고, 묶음에 aria-labelledby={`${id}-label`}을 붙인다.
// help: 라벨 오른쪽의 도움말 (?)(M6 6-i). hint는 늘 보이고, 오류는 그 위에 따로 보인다.
export function Field({
  label,
  help,
  error,
  hint,
  group = false,
  children,
}: {
  label: string;
  help?: ReactNode;
  error?: string;
  hint?: string;
  group?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {group ? (
          <span id={`${id}-label`} className="text-xs font-medium text-label">
            {label}
          </span>
        ) : (
          <label htmlFor={id} className="text-xs font-medium text-label">
            {label}
          </label>
        )}
        {help}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {error && (
        <p id={errorId} className="text-xs text-danger-text">
          {/* 색 없이도 알 수 있게 글리프를 붙인다. */}
          <span aria-hidden>! </span>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
