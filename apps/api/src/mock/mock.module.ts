import { Module } from '@nestjs/common';
import { MockController } from './mock.controller.js';

@Module({ controllers: [MockController] })
export class MockModule {}
