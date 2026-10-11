'use client';

import { NODE_SPECS, type NodeType } from '@nodeloom/core';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NodeGlyph } from './node-glyph';
import { DRAG_MIME, NODE_META } from './node-meta';

const TYPES = Object.keys(NODE_SPECS) as NodeType[];

export function Palette() {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const visible = TYPES.filter(
    (t) =>
      !q ||
      `${t} ${NODE_META[t].label} ${NODE_META[t].description}`
        .toLowerCase()
        .includes(q),
  );

  // "/"를 누르면 검색 칸으로. 입력 중일 때는 그대로 글자를 친다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || t.closest('input, textarea, [contenteditable]'))
        return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside
      aria-label="노드 목록"
      className="flex w-56 shrink-0 flex-col gap-3 border-r border-border-subtle bg-surface p-4"
    >
      <div className="relative">
        <Input
          ref={search}
          aria-label="노드 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="노드 검색"
          className="pr-9"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border px-1.5 font-mono text-caption text-muted-foreground">
          /
        </kbd>
      </div>
      <ul className="flex flex-col gap-1">
        {visible.map((type) => (
          <li
            key={type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, type);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="flex cursor-grab items-start gap-3 rounded-md p-2 hover:bg-raised active:cursor-grabbing"
          >
            <NodeGlyph type={type} size="md" />
            <div>
              <div className="text-sm font-bold">{NODE_META[type].label}</div>
              <div className="text-xs text-muted-foreground">
                {NODE_META[type].description}
              </div>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="p-2 text-xs text-muted-foreground">
            일치하는 노드가 없습니다
          </li>
        )}
      </ul>
      <p className="mt-auto text-xs text-muted-foreground">
        캔버스로 끌어다 놓기
      </p>
    </aside>
  );
}
