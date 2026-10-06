'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './field';

type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// 입력 중인 내용(draft)을 스토어 값과 따로 들고 있는다. 입력 중에는 JSON이 잠깐 깨지거나 빈 줄이 생기기 때문이다.
// 스토어 값이 밖에서 바뀌면(Undo 등) 입력 내용을 그 값에 다시 맞춘다. 렌더 중에 비교해 맞추는 React 권장 방식이다.
function useDraft<D>(
  value: unknown,
  toDraft: (v: unknown) => D,
  parse: (d: D) => Parsed,
) {
  const [draft, setDraft] = useState(() => toDraft(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    const parsed = parse(draft);
    if (!parsed.ok || !same(parsed.value, value)) setDraft(toDraft(value));
  }
  return [draft, setDraft] as const;
}

const formatJson = (v: unknown) => JSON.stringify(v ?? {}, null, 2);
function parseJson(text: string): Parsed {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다' };
  }
}

// JSON 값을 글로 편집한다. 올바른 JSON일 때만 스토어에 쓰고, 깨진 동안에는 칸 아래에 알려 준다.
export function JsonField({
  label,
  hint,
  value,
  error,
  onChange,
}: {
  label: string;
  hint?: string;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useDraft(value, formatJson, parseJson);
  const parsed = parseJson(draft);
  return (
    <Field label={label} hint={hint} error={parsed.ok ? error : parsed.error}>
      {(control) => (
        <Textarea
          {...control}
          rows={4}
          className="font-mono text-xs"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const next = parseJson(e.target.value);
            if (next.ok) onChange(next.value);
          }}
        />
      )}
    </Field>
  );
}

type Row = { name: string; value: string };

const toRows = (v: unknown): Row[] =>
  Object.entries((v ?? {}) as Record<string, string>).map(([name, value]) => ({
    name,
    value,
  }));
// 이름이 빈 줄은 아직 입력 중인 줄이라 저장하지 않는다.
const toRecord = (rows: Row[]): Parsed => ({
  ok: true,
  value: Object.fromEntries(
    rows.filter((r) => r.name.trim()).map((r) => [r.name.trim(), r.value]),
  ),
});

// 이름-값 목록(쿼리, 헤더). 값에는 `{{ }}` 템플릿을 쓸 수 있다.
export function KeyValueInput({
  value,
  onChange,
  label,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
}) {
  const [rows, setRows] = useDraft(value, toRows, toRecord);
  const update = (next: Row[]) => {
    setRows(next);
    const parsed = toRecord(next);
    if (parsed.ok && !same(parsed.value, value)) onChange(parsed.value);
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            aria-label={`${label} ${i + 1} 이름`}
            placeholder="이름"
            className="font-mono text-xs"
            value={row.name}
            onChange={(e) =>
              update(rows.with(i, { ...row, name: e.target.value }))
            }
          />
          <Input
            aria-label={`${label} ${i + 1} 값`}
            placeholder="값"
            className="font-mono text-xs"
            value={row.value}
            onChange={(e) =>
              update(rows.with(i, { ...row, value: e.target.value }))
            }
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={`${label} ${i + 1} 삭제`}
            onClick={() => update(rows.filter((_, j) => j !== i))}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setRows([...rows, { name: '', value: '' }])}
      >
        {label} 추가
      </Button>
    </div>
  );
}
