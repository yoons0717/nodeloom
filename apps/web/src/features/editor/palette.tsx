'use client';

import { NODE_SPECS, type NodeType } from '@nodeloom/core';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DRAG_MIME, NODE_META } from './node-meta';

const TYPES = Object.keys(NODE_SPECS) as NodeType[];

export function Palette() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = TYPES.filter(
    (t) =>
      !q ||
      `${t} ${NODE_META[t].label} ${NODE_META[t].description}`
        .toLowerCase()
        .includes(q),
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2.5 border-r border-divider bg-surface p-4">
      <label
        htmlFor="palette-search"
        className="text-xs font-bold text-muted-foreground"
      >
        노드
      </label>
      <Input
        id="palette-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="노드 검색"
      />
      <ul className="flex flex-col gap-2">
        {visible.map((type) => (
          <li
            key={type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, type);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="cursor-grab rounded-md border border-border bg-raised px-3 py-2.5 hover:border-muted-foreground active:cursor-grabbing"
          >
            <div className="font-bold">{NODE_META[type].label}</div>
            <div className="text-xs text-muted-foreground">
              {NODE_META[type].description}
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-xs text-muted-foreground">
            일치하는 노드가 없습니다
          </li>
        )}
      </ul>
      <p className="mt-auto text-xs text-muted-foreground">
        캔버스로 끌어다 놓으세요
      </p>
    </aside>
  );
}
