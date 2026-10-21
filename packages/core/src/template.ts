import jsonata from 'jsonata';
import type { GraphNode } from './graph.js';

export type TemplatePart =
  { kind: 'text'; value: string } | { kind: 'expr'; value: string };

const NODE_REF = /\$nodes\.([a-z][a-z0-9_]*)/g;

// `{{`부터 짝이 맞는 `}}`의 위치. 식 안의 중괄호({"a": {"b": 1}})와 문자열 속 `}}`는 건너뛴다. 없으면 -1.
function closingBraces(input: string, from: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = from; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      if (depth > 0) depth--;
      else if (input[i + 1] === '}') return i;
    }
  }
  return -1;
}

// 문자열 칸의 `{{ 식 }}` 구간을 나눈다. 닫히지 않은 `{{`는 글자로 둔다.
export function parseTemplate(input: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (let open = input.indexOf('{{'); open !== -1;) {
    const close = closingBraces(input, open + 2);
    if (close === -1) break;
    if (open > last)
      parts.push({ kind: 'text', value: input.slice(last, open) });
    parts.push({ kind: 'expr', value: input.slice(open + 2, close).trim() });
    last = close + 2;
    open = input.indexOf('{{', last);
  }
  if (last < input.length)
    parts.push({ kind: 'text', value: input.slice(last) });
  return parts;
}

export function extractNodeRefs(expression: string): string[] {
  return [...new Set([...expression.matchAll(NODE_REF)].map((m) => m[1]!))];
}

export type ExpressionSyntaxError = { message: string; position?: number };

type JsonataError = {
  code?: string;
  message?: string;
  position?: number;
  token?: string;
  value?: string;
};

// 자주 나는 JSONata 문법 오류만 한국어로 바꾸고, 나머지는 원문을 보여 준다.
function koreanSyntaxMessage(err: JsonataError): string | undefined {
  switch (err.code) {
    case 'S0101':
      return '문자열의 따옴표가 닫히지 않았습니다';
    case 'S0201':
      return `"${err.token}" 근처의 문법이 잘못되었습니다`;
    case 'S0202':
      return `"${err.value}"가 와야 하는데 "${err.token}"가 왔습니다`;
    case 'S0203':
      return `"${err.value}"가 빠졌습니다`;
    case 'S0204':
      return `알 수 없는 연산자 "${err.token}"입니다`;
    case 'S0207':
      return '식이 중간에 끝났습니다';
    case 'S0211':
      return `"${err.token}"는 이 자리에 올 수 없습니다`;
  }
}

export function checkExpressionSyntax(
  expression: string,
): ExpressionSyntaxError | null {
  try {
    jsonata(expression);
    return null;
  } catch (e) {
    const err = e as JsonataError;
    const text = koreanSyntaxMessage(err) ?? err.message ?? String(e);
    return {
      message:
        err.position === undefined ? text : `${text} (위치 ${err.position})`,
      position: err.position,
    };
  }
}

export type FieldExpression = { field: string; expression: string };

// 노드 설정에서 JSONata 식을 칸 이름과 함께 모두 꺼낸다. 문자열 칸은 `{{ }}` 안쪽만.
export function nodeExpressions(node: GraphNode): FieldExpression[] {
  const c = node.config;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const templated = (field: string, v: unknown) =>
    parseTemplate(str(v)).flatMap((p) =>
      p.kind === 'expr' ? [{ field, expression: p.value }] : [],
    );
  const recordValues = (v: unknown) =>
    v && typeof v === 'object'
      ? Object.values(v as Record<string, unknown>)
      : [];
  const whole = (field: string) =>
    str(c[field]).trim() ? [{ field, expression: str(c[field]) }] : [];

  switch (node.type) {
    case 'http':
      return [
        ...templated('url', c.url),
        ...recordValues(c.query).flatMap((v) => templated('query', v)),
        ...recordValues(c.headers).flatMap((v) => templated('headers', v)),
        ...whole('body'),
      ];
    case 'transform':
    case 'condition':
      return whole('expression');
    case 'trigger':
      return [];
  }
}
