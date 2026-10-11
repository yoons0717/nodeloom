'use client';

import { Textarea } from '@/components/ui/textarea';
import { configValue, Field, type SettingsProps } from './field';

// Transform과 Condition이 함께 쓰는 JSONata 식 칸.
export function ExpressionField({
  node,
  errors,
  set,
  label,
  hint,
}: SettingsProps & { label: string; hint: string }) {
  const value = configValue(node, 'expression');
  return (
    <Field
      label={label}
      labelNote="JSONata"
      hint={hint}
      error={errors.expression}
      ok={
        typeof value === 'string' && value.trim()
          ? '식이 올바릅니다'
          : undefined
      }
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
