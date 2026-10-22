import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { env, secrets } from './env.js';
import { MaskingLogger } from './masking-logger.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  logger: new MaskingLogger(Object.values(secrets)),
});
setupApp(app);
// 브라우저는 Next의 /api/*로만 들어오고 Next는 같은 기기에서 중계하므로, 바깥 네트워크에는 열지 않는다.
await app.listen(env.PORT, '127.0.0.1');
