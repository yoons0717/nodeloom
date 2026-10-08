import { ConsoleLogger } from '@nestjs/common';
import { createMasker } from './executor/mask.js';

// Nest 기본 로거와 같고, 내보내기 직전에 비밀값을 ***로 바꾼다(DECISIONS 8-2).
export class MaskingLogger extends ConsoleLogger {
  private readonly mask: (text: string) => string;

  constructor(secretValues: string[]) {
    super();
    this.mask = createMasker(secretValues).text;
  }

  protected override formatMessage(
    ...args: Parameters<ConsoleLogger['formatMessage']>
  ) {
    return this.mask(super.formatMessage(...args));
  }

  protected override printStackTrace(stack: string) {
    super.printStackTrace(stack && this.mask(stack));
  }
}
