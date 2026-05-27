import { api } from '../../../lib/api';
import { Feed } from '../../../components/Feed';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await api<any>(`/posts/${params.id}`).catch(() => null);
  return (
    <main className="single">
      <h1>KrazyVerse</h1>
      {post ? <Feed posts={[post]} /> : <p>Post not found or unavailable.</p>}
    </main>
  );
}
