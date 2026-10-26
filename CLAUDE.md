# apay (Aura Pay)

UPI-style, mobile-first web app for sending "aura" (✦) to friends. Next.js 15 App Router + Tailwind v4 + Neon Postgres (`@neondatabase/serverless`). See README.md for features and layout.

## Conventions
- Mobile-first UI, clean and minimal. Colors are CSS tokens in `src/app/globals.css` (`bg-bg`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, ...) Light is the default; dark tokens apply only under `<html data-theme="dark">` (not OS preference). Use these, not raw colors.
- Aura amounts are whole integers. New users start with 1000.
- Aura ID = `handle` column; display as `handle@aura` via `auraId()` in `src/lib/validate.ts`. URLs use the bare handle (`/chat/[handle]`).
- Auth: JWT in httpOnly cookie `apay_session` (`src/lib/token.ts`, `src/lib/session.ts`); `src/middleware.ts` guards pages. API routes call `currentUserId()` themselves.
- 4-digit Aura PIN, bcrypt-hashed, checked via `checkPin()` (5 wrong → 5-min lock). Balance is only returned by `POST /api/balance` with a PIN.
- Transfers are one atomic SQL statement in `transferAura()` (`src/lib/queries.ts`). Keep it that way.
- `users.verified` is set manually in the DB (no UI/API). Render names with `<VerifiedName>` (`src/components/VerifiedName.tsx`) so the badge shows.
- Schema changes: add `ALTER TABLE ... IF NOT EXISTS` lines to `db/schema.sql` (it's re-run by `db:migrate`).
- Push notifications: `web-push` with VAPID keys from env. Server sends via `notifyUser()` (`src/lib/push.ts`) inside `after()` in the chat and pay routes; never let push failures fail a request. Service worker is `public/sw.js` (skips the notification if that chat is focused). Browser side is `src/lib/pushClient.ts`; `NotificationPrompt` on home asks permission; logout unsubscribes the device.
- Chat: text and payments share the `messages` table; client polls `GET /api/chat/[handle]?after=<id>` every 3s.

## Status (2026-10-26)
- All features built; `tsc`, `lint` and `next build` pass.
- NOT yet run against a real DB. Next steps:
  1. User puts Neon pooled connection string in `.env.local` as `DATABASE_URL` (`AUTH_SECRET` already generated).
  2. `npm run db:migrate`, then `npm run dev`.
  3. Smoke-test end to end: sign up two users, add friend, create PIN, reveal balance, chat, send aura, check both balances.
- TODO: Settings screen with a Light/Dark toggle that sets `data-theme` on `<html>` (persist in a cookie so the server renders it without a flash).
- Possible next features: forgot/reset PIN, transaction history screen, login rate limiting.
