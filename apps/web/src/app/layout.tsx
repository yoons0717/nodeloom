import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nodeloom',
  description: '노드를 이어 반복 작업을 자동화하는 워크플로우 도구',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
