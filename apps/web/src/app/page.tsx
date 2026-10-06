import { GRAPH_SCHEMA_VERSION } from '@nodeloom/core';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Nodeloom</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        노드를 이어 반복 작업을 자동화하는 워크플로우 도구
      </p>
      <p className="mt-6 text-sm text-zinc-500">
        그래프 형식 버전: {GRAPH_SCHEMA_VERSION}
      </p>
    </main>
  );
}
