// pg-boss가 쓰는 시계. 테스트에서 시험용 시계(TestClock)로 갈아 끼운다.
// env.ts를 읽지 않는 파일에 두어 테스트가 앱을 띄우기 전에 import할 수 있게 한다.
export const PG_BOSS_CLOCK = Symbol('PG_BOSS_CLOCK');
