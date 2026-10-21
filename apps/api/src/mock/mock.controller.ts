import { setTimeout as sleep } from 'node:timers/promises';
import {
  All,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator.js';

// 연습용 응답. 예시 흐름과 실행기 테스트가 외부 서비스 없이 HTTP 요청을 보낸다.
// 로그인 없이 열려 있고, 데모 서버에서는 전체 속도 제한을 받는다.
@Public()
@Controller('mock')
export class MockController {
  @Get('weather')
  weather(@Query('city') city = 'Seoul') {
    return { city, temp: 21, rain: false };
  }

  // 받은 요청을 그대로 돌려준다.
  @All('echo')
  echo(@Req() req: Request): Record<string, unknown> {
    return {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      headers: req.headers,
      body: req.body as unknown,
    };
  }

  @All('status/:code')
  status(@Param('code', ParseIntPipe) code: number, @Res() res: Response) {
    res.status(Math.min(Math.max(code, 200), 599)).json({ status: code });
  }

  // 리다이렉트를 따라가지 않는지 시험용
  @Get('redirect')
  redirect(@Query('to') to: string, @Res() res: Response) {
    res.redirect(302, to);
  }

  // 시간 제한 시험용. 최대 30초
  @All('slow')
  async slow(@Query('ms') ms = '1000') {
    await sleep(Math.min(Number(ms) || 0, 30_000));
    return { ok: true };
  }

  // 큰 JSON 보기 측정용(M9). 항목 n개(최대 2만)짜리 목록. 항목 하나가 약 60바이트라 1만 5천 개면 1MB에 가깝다.
  @Get('items/:n')
  items(@Param('n', ParseIntPipe) n: number) {
    const count = Math.min(Math.max(n, 0), 20_000);
    return {
      total: count,
      items: Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        price: i * 10,
        tags: ['a', 'b'],
      })),
    };
  }

  // 응답 크기 제한 시험용. 최대 2MB
  @Get('bytes/:n')
  bytes(@Param('n', ParseIntPipe) n: number) {
    return 'a'.repeat(Math.min(Math.max(n, 0), 2 * 1024 * 1024));
  }
}
