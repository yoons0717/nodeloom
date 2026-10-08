import { createMasker } from './mask.js';

describe('비밀값 가리기', () => {
  const mask = createMasker(['s3cret/tok en', 'another-secret']);

  it('원래 값, URL 인코딩 값, JSON 안의 값을 가린다', () => {
    expect(mask.text('a s3cret/tok en b')).toBe('a *** b');
    expect(mask.text('?t=s3cret%2Ftok%20en')).toBe('?t=***');
    expect(mask.text(JSON.stringify({ k: 'x"another-secret' }))).toBe(
      '{"k":"x\\"***"}',
    );
  });

  it('객체와 배열 안의 문자열과 키를 가린다', () => {
    expect(
      mask.value({ list: ['another-secret', 1, null], 'another-secret': true }),
    ).toEqual({ list: ['***', 1, null], '***': true });
  });
});
