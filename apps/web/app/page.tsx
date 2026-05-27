import { Bell, Home, PlusSquare, Search, UserRound, Video } from 'lucide-react';
import { Feed } from '../components/Feed';
import { PostComposer } from '../components/PostComposer';
import { api } from '../lib/api';

export const dynamic = 'force-dynamic';

async function getFeed() {
  return api<any[]>('/feed?mode=recommended').catch(() => demoFeed);
}

export default async function Page() {
  const posts = await getFeed();
  return (
    <main className="shell">
      <aside className="sidebar">
        <h1>KrazyVerse</h1>
        <nav>
          <a className="active"><Home size={20} /> Home</a>
          <a><Search size={20} /> Search</a>
          <a><PlusSquare size={20} /> Create</a>
          <a><Video size={20} /> Reels</a>
          <a><Bell size={20} /> Notifications</a>
          <a><UserRound size={20} /> Profile</a>
        </nav>
      </aside>
      <section className="main-column">
        <div className="story-strip">
          {['You', 'Close Friends', 'Travel', 'AI', 'Live'].map((item) => (
            <div className="story" key={item}>
              <span />
              <small>{item}</small>
            </div>
          ))}
        </div>
        <PostComposer />
        <Feed posts={posts} />
      </section>
      <aside className="rightbar">
        <section>
          <h2>Trending</h2>
          <p>#launchday</p>
          <p>#reels</p>
          <p>#creatorpro</p>
        </section>
        <section>
          <h2>Creator</h2>
          <p>Reach, earnings, gifts, subscriptions, marketplace, and brand collaboration APIs are ready.</p>
        </section>
      </aside>
    </main>
  );
}

const demoFeed = [
  {
    id: 'demo-web',
    caption: 'KrazyVerse web is wired to the backend feed with create, stories, reels, search, DMs, AI, and creator tools.',
    media: [],
    author: { profile: { username: 'krazyverse', displayName: 'KrazyVerse' } },
    _count: { likes: 0, comments: 0, saves: 0 },
  },
];
