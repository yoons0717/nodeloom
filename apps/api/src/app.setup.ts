import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ADMIN_BODY_SIZE, DEMO_LIMITS } from './demo-limits.js';
import { env } from './env.js';

// main.ts와 통합 테스트가 같은 설정으로 앱을 띄우도록 한 곳에 모은다.
export function setupApp(app: NestExpressApplication) {
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', {
    limit: env.DEMO_MODE ? DEMO_LIMITS.bodySize : ADMIN_BODY_SIZE,
  });
  // 요청은 Next를 거쳐 들어온다. 속도 제한이 Next 주소가 아니라 실제 방문자 IP를 보도록,
  // 같은 기기·내부망에서 온 X-Forwarded-For만 믿는다. 실제 IP는 배포 시 앞단 프록시가 넣는다.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.enableShutdownHooks();
  return app;
}
