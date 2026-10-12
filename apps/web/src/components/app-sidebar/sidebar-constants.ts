// 서버(레이아웃)와 클라이언트가 함께 읽는 값. 'use client' 파일에서 내보내면 서버에서는 문자열이 아니라
// 클라이언트 참조가 되어 쿠키를 찾지 못하므로 따로 둔다.
export const COLLAPSED_KEY = 'nodeloom.sidebar.collapsed';
