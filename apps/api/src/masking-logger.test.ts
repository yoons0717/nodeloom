import { MaskingLogger } from './masking-logger.js';

describe('MaskingLogger', () => {
  it('로그 메시지와 오류 스택의 비밀값을 가린다', () => {
    const out: string[] = [];
    const write = (chunk: string | Uint8Array) => {
      out.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(write);
    vi.spyOn(process.stderr, 'write').mockImplementation(write);

    const logger = new MaskingLogger(['probe-secret-xyz']);
    logger.log('요청 https://h/?k=probe-secret-xyz');
    logger.error(new Error('실패: probe-secret-xyz'));
    vi.restoreAllMocks();

    const text = out.join('');
    expect(text).not.toContain('probe-secret-xyz');
    expect(text).toContain('k=***');
    expect(text).toContain('실패: ***');
  });
});
