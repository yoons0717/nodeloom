import jsonata from 'jsonata';
import { parseTemplate } from './template.js';

// 식이 볼 수 있는 값. 루트는 직전 노드의 출력이다.
export type EvalContext = {
  input: unknown;
  nodes: Record<string, unknown>;
  run: unknown;
  secrets: Record<string, string>;
};

// 가드레일: 식 1회 1초, 재귀 깊이, 배열 길이
export const EXPRESSION_LIMITS = {
  timeout: 1000,
  stack: 200,
  sequence: 100_000,
};

export class ExpressionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type JsonataError = { code?: string; message?: string; position?: number };

function koreanRuntimeMessage(err: JsonataError): string | undefined {
  switch (err.code) {
    case 'D1012':
      return `식 계산이 ${EXPRESSION_LIMITS.timeout / 1000}초를 넘었습니다`;
    case 'D1011':
      return '재귀가 너무 깊습니다';
    case 'D2014':
    case 'D2015':
      return `배열이 너무 큽니다(최대 ${EXPRESSION_LIMITS.sequence.toLocaleString()}개)`;
  }
}

export async function evaluate(
  expression: string,
  ctx: EvalContext,
): Promise<unknown> {
  try {
    return await jsonata(expression, EXPRESSION_LIMITS).evaluate(ctx.input, {
      nodes: ctx.nodes,
      run: ctx.run,
      secrets: ctx.secrets,
    });
  } catch (e) {
    const err = e as JsonataError;
    const text = koreanRuntimeMessage(err) ?? err.message ?? String(e);
    throw new ExpressionError(
      err.position === undefined ? text : `${text} (위치 ${err.position})`,
      err.code,
    );
  }
}

// 문자열 칸의 `{{ }}`를 계산한 값으로 바꾼다. 값이 없으면 빈 글자, 객체·배열은 JSON으로.
export async function fillTemplate(
  template: string,
  ctx: EvalContext,
): Promise<string> {
  const parts = await Promise.all(
    parseTemplate(template).map(async (p) => {
      if (p.kind === 'text') return p.value;
      const v = await evaluate(p.value, ctx);
      if (v === undefined || v === null) return '';
      return typeof v === 'string' ? v : (JSON.stringify(v) ?? '');
    }),
  );
  return parts.join('');
}
