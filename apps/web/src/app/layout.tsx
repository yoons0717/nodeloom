import type { Metadata } from 'next';
import { JetBrains_Mono, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// 한글 글꼴은 next/font에 한국어 subset이 없어 미리 불러오지 않는다(preload: false). 쓰는 글자 범위만 내려받는다.
const notoSansKr = Noto_Sans_KR({
  preload: false,
  variable: '--font-noto-sans-kr',
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Nodeloom',
  description: '노드를 이어 반복 작업을 자동화하는 워크플로우 도구',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${notoSansKr.variable} ${jetBrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
