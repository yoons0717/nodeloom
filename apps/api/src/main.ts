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
await app.listen(env.PORT);
