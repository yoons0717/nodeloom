import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

// 전역 인증 Guard의 예외. 붙이지 않은 경로는 모두 로그인이 필요하다.
export const Public = () => SetMetadata(IS_PUBLIC, true);
