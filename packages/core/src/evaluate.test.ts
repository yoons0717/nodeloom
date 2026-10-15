import { describe, expect, it } from 'vitest';
import {
  type EvalContext,
  evaluate,
  ExpressionError,
  fillTemplate,
} from './evaluate.js';

const ctx: EvalContext = {
  input: { city: 'Seoul', temps: [3, 5] },
  nodes: { weather_1: { temp: 21 } },
  run: { id: 'r1' },
  secrets: { TOKEN: 'abc' },
};

describe('evaluate', () => {
  it('직전 노드 출력이 루트이고 $nodes, $run, $secrets를 쓸 수 있다', async () => {
    expect(
      await evaluate(
        '{ "c": city, "t": $nodes.weather_1.temp, "r": $run.id, "s": $secrets.TOKEN }',
        ctx,
      ),
    ).toEqual({ c: 'Seoul', t: 21, r: 'r1', s: 'abc' });
  });

  it('가드레일: 끝없는 재귀와 너무 큰 배열은 오류', async () => {
    const codeOf = (expr: string) =>
      evaluate(expr, ctx).catch((e: ExpressionError) => e.code);
    expect(
      await codeOf('($f := function($n) { $f($n + 1) + 1 }; $f(0))'),
    ).toMatch(/D1011|D1012/);
    await expect(evaluate('[1..1000000]', ctx)).rejects.toThrow(
      '배열이 너무 큽니다',
    );
  });

  it('실행 중 오류는 ExpressionError로 바뀐다', async () => {
    const err = await evaluate('city + 1', ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExpressionError);
    expect(err).toMatchObject({ code: 'T2001' });
  });
});

describe('fillTemplate', () => {
  it('{{ }}를 값으로 바꾼다. 없는 값은 빈 글자, 객체는 JSON', async () => {
    expect(
      await fillTemplate(
        'https://h/{{ city }}?t={{ $secrets.TOKEN }}&x={{ nope }}&a={{ temps }}',
        ctx,
      ),
    ).toBe('https://h/Seoul?t=abc&x=&a=[3,5]');
  });

  it('값이 null이면 "null"이 아니라 빈 글자로 바꾼다', async () => {
    expect(await fillTemplate('a={{ null }}', ctx)).toBe('a=');
  });
});
