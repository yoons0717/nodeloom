'use client';

import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { KeyValueInput } from './draft-fields';
import { configDefault, configValue, Field, type SettingsProps } from './field';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function HttpSettings({ node, errors, set }: SettingsProps) {
  const text = (field: string) => {
    const v = configValue(node, field);
    return typeof v === 'string' ? v : '';
  };
  // 숫자 칸은 비울 수 있어야 하므로 기본값을 값이 아니라 안내 글(placeholder)로 보여 준다. 비우면 기본값이 쓰인다.
  const numberInput = (field: string) => {
    const v = node.config[field];
    return {
      type: 'number',
      inputMode: 'numeric' as const,
      placeholder: String(configDefault(node, field)),
      value: typeof v === 'number' ? String(v) : '',
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        set(field, e.target.value === '' ? undefined : Number(e.target.value)),
    };
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="메서드" error={errors.method}>
          {(control) => (
            <Select
              value={text('method')}
              onValueChange={(v) => set('method', v)}
              items={METHODS.map((m) => ({ value: m, label: m }))}
            >
              <SelectTrigger {...control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="타임아웃(초)" error={errors.timeoutSec}>
          {(control) => <Input {...control} {...numberInput('timeoutSec')} />}
        </Field>
      </div>
      <Field
        label="URL"
        hint="{{ }} 안에 JSONata 식을 쓸 수 있습니다"
        error={errors.url}
      >
        {(control) => (
          <Input
            {...control}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder="https://"
            value={text('url')}
            onChange={(e) => set('url', e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">쿼리</span>
        <KeyValueInput
          label="쿼리"
          value={configValue(node, 'query')}
          onChange={(v) => set('query', v)}
        />
        {errors.query && (
          <p className="text-xs text-destructive-text">{errors.query}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">헤더</span>
        <KeyValueInput
          label="헤더"
          value={configValue(node, 'headers')}
          onChange={(v) => set('headers', v)}
        />
        {errors.headers && (
          <p className="text-xs text-destructive-text">{errors.headers}</p>
        )}
      </div>
      <Field
        label="본문 (JSONata 식)"
        hint="객체를 만드는 식. 비워 두면 본문 없이 보냅니다"
        error={errors.body}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={4}
            spellCheck={false}
            className="font-mono text-xs"
            value={text('body')}
            onChange={(e) => set('body', e.target.value)}
          />
        )}
      </Field>
      <Field label="재시도 횟수" error={errors.retry}>
        {(control) => <Input {...control} {...numberInput('retry')} />}
      </Field>
      <label className="flex min-h-11 items-center gap-2.5 text-[13px]">
        <Switch
          checked={configValue(node, 'continueOnNon2xx') === true}
          onCheckedChange={(v) => set('continueOnNon2xx', v)}
        />
        2xx가 아니어도 계속
      </label>
    </>
  );
}
