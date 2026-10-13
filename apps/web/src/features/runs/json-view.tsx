'use client';

import { useState } from 'react';

export type JsonPath = (string | number)[];

// 처음에는 두 단계까지만 펼친다. 큰 출력도 처음 그리는 양이 작다.
const OPEN_DEPTH = 2;

// 노드 입출력 JSON 보기(데모: 12/20 고정폭, 키·숫자·문자열 색 구분, 객체 접기).
// 값 줄을 누르면 onSelect로 그 값의 경로를 알린다.
export function JsonView({
  value,
  selected,
  onSelect,
}: {
  value: unknown;
  selected?: JsonPath;
  onSelect?: (path: JsonPath, value: unknown) => void;
}) {
  return (
    <div className="font-mono text-xs leading-5 text-label">
      <Entry
        value={value}
        path={[]}
        depth={0}
        selected={selected}
        onSelect={onSelect}
        last
      />
    </div>
  );
}

function Entry({
  name,
  value,
  path,
  depth,
  selected,
  onSelect,
  last,
}: {
  name?: string | number;
  value: unknown;
  path: JsonPath;
  depth: number;
  selected?: JsonPath;
  onSelect?: (path: JsonPath, value: unknown) => void;
  last: boolean;
}) {
  const [open, setOpen] = useState(depth < OPEN_DEPTH);
  const comma = last ? '' : ',';
  const label =
    name === undefined ? null : typeof name === 'number' ? null : (
      <>
        <span className="text-node-http-text">{JSON.stringify(name)}</span>
        {': '}
      </>
    );
  const indent = { paddingLeft: depth * 16 };

  if (value !== null && typeof value === 'object') {
    const isArray = Array.isArray(value);
    const entries: [string | number, unknown][] = isArray
      ? value.map((v, i) => [i, v])
      : Object.entries(value);
    const [openMark, closeMark] = isArray ? ['[', ']'] : ['{', '}'];
    if (entries.length === 0)
      return (
        <div style={indent}>
          {label}
          {openMark}
          {closeMark}
          {comma}
        </div>
      );
    return (
      <>
        <div style={indent}>
          <button
            type="button"
            aria-expanded={open}
            className="text-left hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {label}
            {open ? (
              openMark
            ) : (
              <>
                {openMark}
                <span className="text-muted-foreground">
                  {' '}
                  … {entries.length}{' '}
                </span>
                {closeMark}
                {comma}
              </>
            )}
          </button>
        </div>
        {open && (
          <>
            {entries.map(([k, v], i) => (
              <Entry
                key={k}
                name={k}
                value={v}
                path={[...path, k]}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                last={i === entries.length - 1}
              />
            ))}
            <div style={indent}>
              {closeMark}
              {comma}
            </div>
          </>
        )}
      </>
    );
  }

  const isSelected =
    selected !== undefined &&
    selected.length === path.length &&
    selected.every((p, i) => p === path[i]);
  return (
    <div style={indent}>
      <button
        type="button"
        className={`rounded-sm text-left hover:bg-raised-hover pointer-coarse:py-1 ${isSelected ? 'bg-accent-soft' : ''}`}
        onClick={() => onSelect?.(path, value)}
      >
        {label}
        <Scalar value={value} />
        {comma}
      </button>
    </div>
  );
}

function Scalar({ value }: { value: unknown }) {
  if (typeof value === 'string')
    return <span className="text-success-text">{JSON.stringify(value)}</span>;
  if (typeof value === 'number' || typeof value === 'boolean')
    return <span className="text-node-condition-text">{String(value)}</span>;
  return <span className="text-muted-foreground">null</span>;
}

// 고른 값을 다른 노드의 식에서 읽는 경로(JSONata). 이름에 특수 문자가 있으면 `백틱`으로 감싼다.
export function toExpression(key: string, path: JsonPath) {
  return path.reduce<string>(
    (expr, p) =>
      typeof p === 'number'
        ? `${expr}[${p}]`
        : /^[A-Za-z_$][\w$]*$/.test(p)
          ? `${expr}.${p}`
          : `${expr}.\`${p}\``,
    `$nodes.${key}`,
  );
}
