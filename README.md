# KrazyVerse

KrazyVerse is a TypeScript monorepo for an Instagram-like social platform with Expo mobile, Next.js web/admin, Express API, Prisma/PostgreSQL, Socket.IO, Redis/BullMQ, Cloudinary/S3 integrations, AI adapters, and shared Zod contracts.

## Apps And Packages

- `apps/api` - Express.js REST API under `/api/v1`, Socket.IO, Prisma schema, auth, posts, stories, reels, DMs, creator tools, admin, security, AI routes.
- `apps/mobile` - Expo React Native app with Home, Search, Create, Reels, Profile tabs, haptics, push, deep links, MMKV cache, biometrics, camera, picker.
- `apps/web` - Next.js 14 App Router social web experience.
- `apps/admin` - Next.js 14 App Router operations panel.
- `packages/shared` - Shared constants, types, and Zod validators.

## Local Setup

1. Install Node.js 20+ and npm 10+.
2. Copy `.env.example` to `.env` and fill provider keys as needed.
3. Start local infrastructure:

```bash
docker compose up -d
```

4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client and migrate:

```bash
npm run db:generate
npm run db:migrate
```

6. Run the API:

```bash
npm run dev:api
```

7. Run clients in separate terminals:

```bash
npm run dev:web
npm run dev:admin
npm run dev:mobile
```

Default URLs:

- API: `http://localhost:4000/api/v1`
- API health: `http://localhost:4000/health`
- Web: `http://localhost:3000`
- Admin: `http://localhost:3001`
- MailHog: `http://localhost:8025`

## Key API Surfaces

- Auth: `/api/v1/auth/signup`, `/login`, `/refresh`, `/logout`, `/verify-otp`, `/forgot-password`, `/reset-password`, `/oauth`, `/phone/start`, `/phone/verify`, `/2fa/start`, `/2fa/verify`, `/devices`.
- Profiles/social: `/api/v1/profiles`, `/api/v1/discovery`, follow requests, close friends, block, mute, notifications.
- Posts/feed: `/api/v1/posts`, drafts, scheduled posts, archive, soft delete/recovery, likes, comments, saves, feed modes.
- Stories/reels: `/api/v1/stories`, highlights, reactions, replies, viewers, `/api/v1/reels`, watch history, duet.
- Messaging: `/api/v1/messages`, conversations, send/edit/delete/forward/react/search/pin/archive/calls.
- AI: `/api/v1/ai/*` for captions, hashtags, moderation, photo enhancement, friend suggestions, feed ranking, video assistant, DM bot, avatar, profile themes, stories, voice clone, translation, subtitles.
- Creator/admin/security/future: `/api/v1/creator`, `/api/v1/admin`, `/api/v1/security`, `/api/v1/future`.

## Realtime

Socket.IO authenticates with the API access token:

- Client events: `message:send`, `typing:start`, `typing:stop`, `presence:update`, `story:view`.
- Server events: `message:new`, `typing:update`, `presence:update`, `notification:new`, `story:viewed`.

## Quality

```bash
npm run lint
npm run test
npm run build
```

The initial Jest coverage includes auth utilities and post media/hashtag rules. Prisma models cover the requested core schema plus supporting tables for OTPs, external accounts, drafts, story views, close friends, post tags/collabs, and reel watch history.

## Production Notes

- Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Configure Clerk/Firebase, Twilio, SMTP, Cloudinary, AWS S3, Anthropic, Replicate, Giphy, Typesense/Elasticsearch, Expo/FCM, and payment provider keys in `.env`.
- Run API workers separately in production if queue throughput grows.
- Put the API behind TLS, enable managed Redis/Postgres backups, and restrict admin routes to verified admin accounts.
