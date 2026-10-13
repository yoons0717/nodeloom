import { describe, expect, it } from 'vitest';
import {
  checkExpressionSyntax,
  extractNodeRefs,
  nodeExpressions,
  parseTemplate,
} from './template.js';
import { node } from './fixtures.test-util.js';

describe('parseTemplate', () => {
  it('글자와 식 구간을 나눈다', () => {
    expect(parseTemplate('https://h/w?city={{ city }}&u={{$run.id}}')).toEqual([
      { kind: 'text', value: 'https://h/w?city=' },
      { kind: 'expr', value: 'city' },
      { kind: 'text', value: '&u=' },
      { kind: 'expr', value: '$run.id' },
    ]);
  });

  it('식 안의 중괄호와 문자열 속 }}는 식의 끝으로 보지 않는다', () => {
    expect(parseTemplate('a={{ $string({"x": {"y": 1}}) }}&b')).toEqual([
      { kind: 'text', value: 'a=' },
      { kind: 'expr', value: '$string({"x": {"y": 1}})' },
      { kind: 'text', value: '&b' },
    ]);
    expect(parseTemplate('{{ "}}" & name }}')).toEqual([
      { kind: 'expr', value: '"}}" & name' },
    ]);
    // 닫히지 않은 {{는 글자로 둔다.
    expect(parseTemplate('a={{ city')).toEqual([
      { kind: 'text', value: 'a={{ city' },
    ]);
  });

  it('식이 없는 글자는 그대로 돌려준다', () => {
    expect(parseTemplate('https://h/w')).toEqual([
      { kind: 'text', value: 'https://h/w' },
    ]);
  });
});

describe('extractNodeRefs', () => {
  it('$nodes 참조 키를 중복 없이 찾는다', () => {
    expect(
      extractNodeRefs(
        '$nodes.weather_1.body.temp & $nodes.weather_1.x & $nodes.dust_1',
      ),
    ).toEqual(['weather_1', 'dust_1']);
  });
});

describe('checkExpressionSyntax', () => {
  it('올바른 식은 통과한다', () => {
    expect(checkExpressionSyntax('body.rain > 60')).toBeNull();
  });

  it('잘못된 식은 오류 위치를 알려준다', () => {
    expect(checkExpressionSyntax('body.rain >')).toMatchObject({
      position: 11,
    });
  });

  it('자주 나는 문법 오류는 한국어로 알려준다', () => {
    expect(checkExpressionSyntax('body.rain >')?.message).toBe(
      '식이 중간에 끝났습니다 (위치 11)',
    );
  });
});

describe('nodeExpressions', () => {
  it('HTTP 노드에서 템플릿 안쪽 식과 본문 식을 모은다', () => {
    const n = node('h', 'http', {
      url: 'https://h/{{ a }}',
      headers: { Authorization: 'Bearer {{ $secrets.TOKEN }}' },
      body: '{ "x": b }',
    });
    expect(nodeExpressions(n)).toEqual([
      { field: 'url', expression: 'a' },
      { field: 'headers', expression: '$secrets.TOKEN' },
      { field: 'body', expression: '{ "x": b }' },
    ]);
  });
});
