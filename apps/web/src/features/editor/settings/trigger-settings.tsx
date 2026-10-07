'use client';

import { Input } from '@/components/ui/input';
import { JsonField } from './draft-fields';
import { configValue, Field, type SettingsProps } from './field';

export function TriggerSettings({ node, errors, set }: SettingsProps) {
  const cron = configValue(node, 'cron');
  return (
    <>
      <Field
        label="스케줄 (cron)"
        hint="비워 두면 직접 실행할 때만 동작합니다. 예: 0 7 * * *(매일 7시)"
        error={errors.cron}
      >
        {(control) => (
          <Input
            {...control}
            className="font-mono text-xs"
            placeholder="0 7 * * *"
            value={typeof cron === 'string' ? cron : ''}
            // 빈 칸은 스케줄 없음(null)으로 저장한다.
            onChange={(e) =>
              set('cron', e.target.value.trim() ? e.target.value : null)
            }
          />
        )}
      </Field>
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
