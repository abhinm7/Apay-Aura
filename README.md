# apay — Aura Pay

A mobile-first UPI-style app for sending **aura** (✦) to friends. Next.js 15 (App Router) + Neon Postgres.

## Features

- Sign up with name, phone and password, then pick an Aura ID (`you@aura`). Everyone starts with ✦ 1,000.
- Balance is hidden by default; tapping the eye asks for your 4-digit Aura PIN (created on first use).
- Friends row on the home screen; tap a friend to chat or pay.
- Search people by name, Aura ID or phone and add them as friends.
- Payments are PIN-protected and atomic (single SQL statement). 5 wrong PINs lock it for 5 minutes.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate           # creates tables in Neon
npm run dev
```

Open http://localhost:3000 — use your browser's mobile device mode for the intended layout.

## Layout

- `db/schema.sql` — tables: `users`, `friendships`, `messages` (text and payment messages share one timeline)
- `src/lib/` — DB client, session (JWT cookie), queries, PIN check, validation
- `src/app/api/` — route handlers: auth, pin, balance, friends, search, chat, pay
- `src/app/` — pages: `/`, `/login`, `/signup`, `/chat/[handle]`
