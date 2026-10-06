import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './env.js';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(env.PORT);
