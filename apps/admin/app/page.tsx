import { Activity, Bell, Flag, Gauge, Megaphone, Shield, Users, WalletCards } from 'lucide-react';
import { adminApi } from '../lib/api';
import { Metric } from '../components/Metric';

export const dynamic = 'force-dynamic';

async function loadDashboard() {
  return adminApi<any>('/admin/dashboard').catch(() => ({
    dau: 0,
    mau: 0,
    revenueCents: 0,
    openReports: 0,
    topContent: [],
  }));
}

export default async function AdminPage() {
  const dashboard = await loadDashboard();
  return (
    <main className="admin-shell">
      <aside className="admin-nav">
        <h1>KrazyVerse Admin</h1>
        <a className="active"><Gauge size={18} /> Dashboard</a>
        <a><Users size={18} /> Users</a>
        <a><Shield size={18} /> Moderation</a>
        <a><Flag size={18} /> Reports</a>
        <a><Megaphone size={18} /> Ads</a>
        <a><Bell size={18} /> Push</a>
        <a><Activity size={18} /> Monitoring</a>
      </aside>
      <section className="admin-main">
        <header className="topbar">
          <div>
            <h2>Operations Dashboard</h2>
            <p>DAU, MAU, revenue, top content, moderation, ads, push, and feature flags.</p>
          </div>
          <button>Feature Flags</button>
        </header>
        <div className="metrics">
          <Metric label="DAU" value={dashboard.dau} detail="Active device sessions, 24h" />
          <Metric label="MAU" value={dashboard.mau} detail="Active device sessions, 30d" />
          <Metric label="Revenue" value={`$${((dashboard.revenueCents ?? 0) / 100).toFixed(2)}`} detail="Creator and ad earnings" />
          <Metric label="Open Reports" value={dashboard.openReports} detail="Needs moderator review" />
        </div>
        <div className="grid">
          <section className="panel wide">
            <h3>Top Content</h3>
            <table>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Caption</th>
                  <th>Likes</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard.topContent ?? []).length ? (
                  dashboard.topContent.map((post: any) => (
                    <tr key={post.id}>
                      <td>@{post.author?.profile?.username ?? 'creator'}</td>
                      <td>{post.caption ?? 'Untitled'}</td>
                      <td>{post._count?.likes ?? 0}</td>
                      <td>{post._count?.comments ?? 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No content yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <section className="panel">
            <h3>Moderation Queue</h3>
            <p>AI-flagged posts, comments, reels, report triage, temporary and permanent bans.</p>
            <button><Shield size={16} /> Review</button>
          </section>
          <section className="panel">
            <h3>Revenue Controls</h3>
            <p>Ads, Pro subscriptions, gifts, paid verification, marketplace, and brand deals.</p>
            <button><WalletCards size={16} /> Open</button>
          </section>
        </div>
      </section>
    </main>
  );
}
