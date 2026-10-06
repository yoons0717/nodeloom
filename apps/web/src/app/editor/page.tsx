import type { Metadata } from 'next';
import { Editor } from '@/features/editor/editor';

export const metadata: Metadata = { title: '에디터 · Nodeloom' };

export default function EditorPage() {
  return <Editor />;
}
