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
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p
          id={messageId}
          className={`text-xs ${error ? 'text-destructive-text' : 'text-muted-foreground'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
