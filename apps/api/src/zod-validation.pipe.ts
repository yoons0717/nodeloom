import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

// 요청 본문을 zod 스키마로 검사한다. 밖에서 들어온 값은 경계에서 좁힌다(CONVENTIONS 3).
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: '요청 형식이 올바르지 않습니다',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return parsed.data;
  }
}
