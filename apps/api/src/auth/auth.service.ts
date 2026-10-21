import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { env } from '../env.js';
import type { SessionUser } from './session.js';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  // 비밀번호가 맞으면 7일짜리 토큰을 돌려준다.
  async login(password: string): Promise<string> {
    // 데모 서버에서는 관리자 로그인을 끈다.
    if (env.DEMO_MODE)
      throw new ForbiddenException('데모에서는 로그인을 쓰지 않습니다');
    const ok = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH ?? '');
    if (!ok) throw new UnauthorizedException('비밀번호가 올바르지 않습니다');
    const user: SessionUser = { role: 'admin' };
    return this.jwt.signAsync(user);
  }
}
