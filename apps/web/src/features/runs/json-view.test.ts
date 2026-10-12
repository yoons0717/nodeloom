import { describe, expect, it } from 'vitest';
import { toExpression } from './json-view';

describe('toExpression', () => {
  it('고른 값의 경로를 JSONata 식으로 만든다. 특수 문자가 있는 이름은 백틱으로 감싼다', () => {
    expect(toExpression('weather_1', [])).toBe('$nodes.weather_1');
    expect(toExpression('weather_1', ['body', 'items', 0, 'rain'])).toBe(
      '$nodes.weather_1.body.items[0].rain',
    );
    expect(toExpression('w', ['rain-prob', 'a b'])).toBe(
      '$nodes.w.`rain-prob`.`a b`',
    );
  });
});
