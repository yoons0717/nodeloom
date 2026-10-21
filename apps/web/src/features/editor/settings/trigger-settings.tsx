'use client';

import { isValidCron, nextCronRuns } from '@nodeloom/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime, TIMEZONE } from '@/features/workflows/format';
import { meSchema } from '@/features/workflows/schemas';
import { clientApi } from '@/lib/client-api';
import { JsonField } from './draft-fields';
import { configValue, Field, type SettingsProps } from './field';
import {
  DAY_NAMES,
  pad,
  parseSchedule,
  type Schedule,
  toCron,
} from './schedule';

type Kind = Schedule['kind'];
const KINDS: { value: Kind; label: string }[] = [
  { value: 'none', label: '반복 안 함' },
  { value: 'daily', label: '매일' },
  { value: 'weekdays', label: '평일(월~금)' },
  { value: 'weekly', label: '매주' },
  { value: 'hourly', label: '매시간' },
  { value: 'custom', label: '직접 입력 (cron)' },
];
const DAYS = DAY_NAMES.map((d, i) => ({
  value: String(i),
  label: `${d}요일`,
}));

// 반복 종류를 바꿀 때 지금 고른 시각·요일은 그대로 둔다. 없으면 월요일 09:00.
function withKind(
  kind: Kind,
  current: Schedule,
  cron: string | null,
): Schedule {
  const hour = 'hour' in current ? current.hour : 9;
  const minute = 'minute' in current ? current.minute : 0;
  const day = 'day' in current ? current.day : 1;
  switch (kind) {
    case 'none':
      return { kind };
    case 'daily':
    case 'weekdays':
      return { kind, hour, minute };
    case 'weekly':
      return { kind, day, hour, minute };
    case 'hourly':
      return { kind, minute };
    case 'custom':
      return { kind, cron: cron ?? '' };
  }
}

export function TriggerSettings({ node, errors, set }: SettingsProps) {
  const value = configValue(node, 'cron');
  const cron = typeof value === 'string' ? value : null;
  // 직접 입력을 고르면 선택지와 같은 cron이어도 cron 칸을 계속 보여 준다.
  const [customMode, setCustomMode] = useState(
    () => parseSchedule(cron).kind === 'custom',
  );
  const parsed = parseSchedule(cron);
  const schedule: Schedule = customMode
    ? { kind: 'custom', cron: cron ?? '' }
    : parsed;
  const update = (next: Schedule) => set('cron', toCron(next));

  // 데모 서버에서는 스케줄이 돌지 않는다.
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => meSchema.parse(await clientApi('/auth/me')),
  });
  const next =
    cron !== null && isValidCron(cron) ? nextCronRuns(cron, TIMEZONE, 3) : [];

  const time =
    'hour' in schedule ? (
      <Field label="시각" hint={`${TIMEZONE} 기준`}>
        {(control) => (
          <Input
            {...control}
            type="time"
            value={`${pad(schedule.hour)}:${pad(schedule.minute)}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              if (h === undefined || m === undefined) return;
              update({ ...schedule, hour: h, minute: m });
            }}
          />
        )}
      </Field>
    ) : null;

  return (
    <>
      <Field label="반복">
        {(control) => (
          <Select
            value={schedule.kind}
            onValueChange={(v) => {
              if (!v) return;
              setCustomMode(v === 'custom');
              update(withKind(v, parsed, cron));
            }}
            items={KINDS}
          >
            <SelectTrigger {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      {schedule.kind === 'weekly' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="요일">
            {(control) => (
              <Select
                value={String(schedule.day)}
                onValueChange={(v) =>
                  v && update({ ...schedule, day: Number(v) })
                }
                items={DAYS}
              >
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          {time}
        </div>
      ) : (
        time
      )}
      {schedule.kind === 'hourly' && (
        <Field label="분 (0~59)">
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0}
              max={59}
              value={schedule.minute}
              onChange={(e) => {
                if (e.target.value === '') return;
                const m = Number(e.target.value);
                if (Number.isInteger(m) && m >= 0 && m <= 59)
                  update({ ...schedule, minute: m });
              }}
            />
          )}
        </Field>
      )}
      {schedule.kind === 'custom' && (
        <Field
          label="cron"
          hint={`분 시 일 월 요일. 예: */15 9-18 * * 1-5(평일 9~18시 15분마다) · ${TIMEZONE} 기준`}
          error={errors.cron}
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono text-body-sm"
              placeholder="0 7 * * *"
              value={cron ?? ''}
              // 빈 칸은 스케줄 없음(null)으로 저장한다.
              onChange={(e) =>
                set('cron', e.target.value.trim() ? e.target.value : null)
              }
            />
          )}
        </Field>
      )}
      {!me.data ? null : me.data.role === 'demo' ? (
        <p className="text-xs text-muted-foreground">
          데모에서는 스케줄이 실행되지 않습니다
        </p>
      ) : (
        next.length > 0 && (
          <div className="text-xs text-muted-foreground">
            다음 실행
            <ul className="mt-1 font-mono">
              {next.map((d) => (
                <li key={d.getTime()}>{formatDateTime(d.toISOString())}</li>
              ))}
            </ul>
          </div>
        )
      )}
      <JsonField
        label="테스트 입력 (JSON)"
        hint="직접 실행할 때 Trigger가 다음 노드로 넘겨주는 값"
        value={configValue(node, 'testInput')}
        error={errors.testInput}
        onChange={(v) => set('testInput', v)}
      />
    </>
  );
}
