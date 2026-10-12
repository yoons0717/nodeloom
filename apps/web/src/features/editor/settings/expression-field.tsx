'use client';

import type { ReactNode } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ExpressionHelp } from '../help';
import { configValue, Field, type SettingsProps } from './field';

// Transform과 Condition이 함께 쓰는 JSONata 식 칸. help는 도움말 맨 위의 노드별 설명.
export function ExpressionField({
  node,
  errors,
  set,
  label,
  hint,
  help,
}: SettingsProps & { label: string; hint: string; help: ReactNode }) {
  const value = configValue(node, 'expression');
  return (
    <Field
      label={label}
      help={
        <ExpressionHelp label={label} title="이 노드에서는">
          {help}
        </ExpressionHelp>
      }
      hint={hint}
      error={errors.expression}
    >
      {(control) => (
        <Textarea
          {...control}
          rows={5}
          spellCheck={false}
          className="min-h-[72px] font-mono text-body-sm"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => set('expression', e.target.value)}
        />
      )}
    </Field>
  );
}
