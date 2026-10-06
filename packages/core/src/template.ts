import jsonata from 'jsonata';
import type { GraphNode } from './graph.js';

export type TemplatePart =
  { kind: 'text'; value: string } | { kind: 'expr'; value: string };

const TEMPLATE = /\{\{([\s\S]*?)\}\}/g;
const NODE_REF = /\$nodes\.([a-z][a-z0-9_]*)/g;

// 문자열 칸의 `{{ 식 }}` 구간을 나눈다(DECISIONS 3-2).
export function parseTemplate(input: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const m of input.matchAll(TEMPLATE)) {
    if (m.index > last)
      parts.push({ kind: 'text', value: input.slice(last, m.index) });
    parts.push({ kind: 'expr', value: m[1]!.trim() });
    last = m.index + m[0].length;
  }
  if (last < input.length)
    parts.push({ kind: 'text', value: input.slice(last) });
  return parts;
}

export function extractNodeRefs(expression: string): string[] {
  return [...new Set([...expression.matchAll(NODE_REF)].map((m) => m[1]!))];
}

export type ExpressionSyntaxError = { message: string; position?: number };

export function checkExpressionSyntax(
  expression: string,
): ExpressionSyntaxError | null {
  try {
    jsonata(expression);
    return null;
  } catch (e) {
    const err = e as { message?: string; position?: number };
    return { message: err.message ?? String(e), position: err.position };
  }
}

// 노드 설정에서 JSONata 식을 모두 꺼낸다. 문자열 칸은 `{{ }}` 안쪽만.
export function nodeExpressions(node: GraphNode): string[] {
  const c = node.config;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const templated = (v: unknown) =>
    parseTemplate(str(v)).flatMap((p) => (p.kind === 'expr' ? [p.value] : []));
  const recordValues = (v: unknown) =>
    v && typeof v === 'object'
      ? Object.values(v as Record<string, unknown>)
      : [];

  switch (node.type) {
    case 'http':
      return [
        ...templated(c.url),
        ...recordValues(c.query).flatMap(templated),
        ...recordValues(c.headers).flatMap(templated),
        ...(str(c.body).trim() ? [str(c.body)] : []),
      ];
    case 'transform':
    case 'condition':
      return str(c.expression).trim() ? [str(c.expression)] : [];
    case 'trigger':
      return [];
  }
}
