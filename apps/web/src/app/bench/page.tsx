import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BenchEditor } from './bench-editor';

export const metadata: Metadata = { title: '벤치 · Nodeloom' };

const SIZES = [20, 200, 1000];

// 개발 환경과 벤치용 빌드(NEXT_PUBLIC_BENCH=1)에서만 연다.
export default async function BenchPage({ searchParams }: PageProps<'/bench'>) {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NEXT_PUBLIC_BENCH !== '1'
  )
    notFound();
  const { nodes } = await searchParams;
  const count = Number(nodes);
  return <BenchEditor count={SIZES.includes(count) ? count : SIZES[0]!} />;
}
