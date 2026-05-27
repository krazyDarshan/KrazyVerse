'use client';

import { useState } from 'react';
import { CalendarClock, ImagePlus, MapPin, Sparkles, Send } from 'lucide-react';
import { API_URL } from '../lib/api';

export function PostComposer() {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [status, setStatus] = useState('');

  async function publish() {
    setStatus('Publishing...');
    const token = window.localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        caption,
        media: [{ type: 'IMAGE', url: mediaUrl || 'https://picsum.photos/seed/krazyverse/1080/1080' }],
        hashtags: caption.match(/#[\w]+/g)?.map((tag) => tag.slice(1)) ?? [],
      }),
    });
    setStatus(response.ok ? 'Published' : 'Sign in and add a valid media URL to publish');
  }

  return (
    <section className="composer" aria-label="Create post">
      <div className="composer-row">
        <button className="icon-button" title="Add media">
          <ImagePlus size={20} />
        </button>
        <button className="icon-button" title="AI caption">
          <Sparkles size={20} />
        </button>
        <button className="icon-button" title="Add location">
          <MapPin size={20} />
        </button>
        <button className="icon-button" title="Schedule">
          <CalendarClock size={20} />
        </button>
      </div>
      <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} placeholder="Share a moment..." />
      <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Media URL" />
      <button className="primary" onClick={publish}>
        <Send size={18} />
        Publish
      </button>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
