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

// 응답이 계속 없을 때 이 노드가 걸리는 최대 시간(초, DECISIONS B-13).
// 실행기와 같은 규칙: 재시도 대기는 1·2·4초…(최대 30초)에 흔들림이 최대 25% 붙는다(7-3).
export function worstCaseSeconds(timeoutSec: number, retry: number) {
  let wait = 0;
  for (let i = 1; i <= retry; i++) wait += Math.min(2 ** (i - 1), 30) * 1.25;
  return Math.ceil(timeoutSec * (retry + 1) + wait);
}

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

  const timeoutSec = configValue(node, 'timeoutSec');
  const retry = configValue(node, 'retry');
  const worst =
    Number.isInteger(timeoutSec) && Number.isInteger(retry)
      ? worstCaseSeconds(timeoutSec as number, retry as number)
      : undefined;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
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
        <Field label="제한 시간(초)" error={errors.timeoutSec}>
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
            className="font-mono text-body-sm"
            placeholder="https://"
            value={text('url')}
            onChange={(e) => set('url', e.target.value)}
          />
        )}
      </Field>
      <Field label="쿼리" group error={errors.query}>
        {(control) => (
          <KeyValueInput
            label="쿼리"
            control={control}
            value={configValue(node, 'query')}
            onChange={(v) => set('query', v)}
          />
        )}
      </Field>
      <Field label="헤더" group error={errors.headers}>
        {(control) => (
          <KeyValueInput
            label="헤더"
            control={control}
            value={configValue(node, 'headers')}
            onChange={(v) => set('headers', v)}
          />
        )}
      </Field>
      <Field
        label="본문"
        labelNote="JSONata"
        hint="객체를 만드는 식. 비워 두면 본문 없이 보냅니다"
        error={errors.body}
        ok={text('body').trim() ? '식이 올바릅니다' : undefined}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={4}
            spellCheck={false}
            className="font-mono text-body-sm"
            value={text('body')}
            onChange={(e) => set('body', e.target.value)}
          />
        )}
      </Field>
      <Field
        label="재시도 횟수"
        hint={
          worst === undefined
            ? undefined
            : `응답이 계속 없으면 최대 약 ${worst}초 걸립니다(제한 시간 × 시도 ${Number(retry) + 1}번 + 재시도 대기). 실행 전체 제한은 기본 5분입니다`
        }
        error={errors.retry}
      >
        {(control) => <Input {...control} {...numberInput('retry')} />}
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-body-sm">
        <Switch
          checked={configValue(node, 'continueOnNon2xx') === true}
          onCheckedChange={(v) => set('continueOnNon2xx', v)}
        />
        응답 코드가 2xx가 아니어도 다음 노드로 진행
      </label>
    </>
  );
}
