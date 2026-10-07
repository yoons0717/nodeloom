import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// DB 연결은 앱 전체에서 하나만 쓴다. 모듈마다 PrismaService를 따로 등록하면 연결 풀이 여러 개 생긴다.
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
