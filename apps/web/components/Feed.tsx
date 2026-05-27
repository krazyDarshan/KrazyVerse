import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';

type Post = {
  id: string;
  caption?: string;
  media?: { url: string }[];
  author?: { profile?: { username: string; displayName: string } };
  _count?: { likes: number; comments: number; saves: number };
};

export function Feed({ posts }: { posts: Post[] }) {
  return (
    <div className="feed">
      {posts.map((post) => (
        <article key={post.id} className="post">
          <header>
            <div className="avatar">{post.author?.profile?.username?.[0]?.toUpperCase() ?? 'K'}</div>
            <div>
              <strong>{post.author?.profile?.displayName ?? 'KrazyVerse Creator'}</strong>
              <span>@{post.author?.profile?.username ?? 'krazyverse'}</span>
            </div>
          </header>
          <div className="media" style={{ backgroundImage: post.media?.[0]?.url ? `url(${post.media[0].url})` : undefined }}>
            {!post.media?.[0]?.url ? 'KrazyVerse' : null}
          </div>
          <footer>
            <div className="post-actions">
              <button title="Like"><Heart size={21} /></button>
              <button title="Comment"><MessageCircle size={21} /></button>
              <button title="Share"><Send size={21} /></button>
              <button title="Save" className="push"><Bookmark size={21} /></button>
            </div>
            <p><strong>@{post.author?.profile?.username ?? 'creator'}</strong> {post.caption ?? 'Create, remix, message, and monetize.'}</p>
          </footer>
        </article>
      ))}
    </div>
  );
}
