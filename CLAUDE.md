# apay (Aura Pay)

UPI-style, mobile-first web app for sending "aura" (✦) to friends. Next.js 15 App Router + Tailwind v4 + Neon Postgres (`@neondatabase/serverless`). See README.md for features and layout.

## Conventions
- Mobile-first UI, clean and minimal. Colors are CSS tokens in `src/app/globals.css` (`bg-bg`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, ...) Light is the default; dark tokens apply only under `<html data-theme="dark">` (not OS preference). Use these, not raw colors.
- Aura amounts are whole integers. New users start with 1000.
- Aura ID = `handle` column; display as `handle@aura` via `auraId()` in `src/lib/validate.ts`. URLs use the bare handle (`/chat/[handle]`).
- Multiple Aura IDs: `aura_ids` holds every ID (including the main `users.handle`), max 3 per user; its PK keeps IDs unique across accounts. Look users up with `getUserByHandle()` (resolves any ID, returns the main handle). Signup inserts the user and its `aura_ids` row in one statement. `/chat/<extra-id>` redirects to the main ID.
- Profile (`/profile`, linked from the top of `HomeMenu`): change name, add/remove/make-main Aura IDs, change password, change/create Aura PIN (`/api/pin/change` verifies the current PIN via `checkPin`).
- Auth: JWT in httpOnly cookie `apay_session` (`src/lib/token.ts`, `src/lib/session.ts`); `src/middleware.ts` guards pages. API routes call `currentUserId()` themselves.
- 4-digit Aura PIN, bcrypt-hashed, checked via `checkPin()` (5 wrong → 5-min lock). Balance is only returned by `POST /api/balance` with a PIN.
- Transfers are one atomic SQL statement in `transferAura()` (`src/lib/queries.ts`). Keep it that way.
- Aura tax (`src/lib/tax.ts`, shared by client and server): transfers >= 10,000 pay 1% (up to 9,999 is tax-free) of the whole amount (floored). Sender is debited `amount`, receiver credited `amount - tax`; `messages.tax` records it. The pay sheet shows a warning and needs a second tap before the PIN.
- Leagues (`src/lib/league.ts`): Rookie 0, Seeker 5k, Farmer 10k, Master 100k, Overlord 500k, God 1M (each "or more"). Home page passes `leagueStatus()` (league + aura to next, not the raw balance) to `LeagueBadge` next to the name; tapping it opens the ladder sheet. Colors are `--league-*` tokens.
- `users.verified` is set manually in the DB (no UI/API). Render names with `<VerifiedName>` (`src/components/VerifiedName.tsx`) so the badge shows.
- Schema changes: add `ALTER TABLE ... IF NOT EXISTS` lines to `db/schema.sql` (it's re-run by `db:migrate`).
- Push notifications: `web-push` with VAPID keys from env. Server sends via `notifyUser()` (`src/lib/push.ts`) inside `after()` in the chat and pay routes; never let push failures fail a request. Service worker is `public/sw.js` (skips the notification if that chat is focused). Browser side is `src/lib/pushClient.ts`; `NotificationPrompt` on home asks permission; logout unsubscribes the device.
- Quick actions under the balance (`QuickActions`): Scan (`ScanSheet`, camera + `jsqr`), Receive (`ReceiveSheet`, `qrcode`), History (`/history`, `listPayments()`), Aura Loan (coming-soon sheet). Receive QRs encode `payLink()` = `<origin>/chat/<handle>?pay=1` (`src/lib/qr.ts`); `?pay=1` opens the pay sheet in `ChatView`.
- Home menu (`HomeMenu`, hamburger top-right) holds a Notifications on/off switch (`pushStatus`/`enablePush`/`disablePush`) and Sign out. The home `NotificationPrompt` card is temporarily commented out in `src/app/page.tsx`.
- Chat: text and payments share the `messages` table; client polls `GET /api/chat/[handle]?after=<id>` every 3s.
- Unread: `chat_reads.last_read_id` per (user, friend); opening a chat and polls that return their messages call `markRead()`. `listFriends()` returns `unread`; `FriendsGrid` shows a blue dot.
- Typing / paying: `chat_activity` heartbeat. `ChatView` POSTs `/api/chat/[handle]/activity` every 2.5s while typing (4s idle cutoff) or while the pay/PIN sheet is open; entries expire after 6s. The chat poll returns the friend's `activity`, shown under their name. Sending a message or payment clears it.

## Status (2026-10-26)
- All features built; `tsc`, `lint` and `next build` pass.
- NOT yet run against a real DB. Next steps:
  1. User puts Neon pooled connection string in `.env.local` as `DATABASE_URL` (`AUTH_SECRET` already generated).
  2. `npm run db:migrate`, then `npm run dev`.
  3. Smoke-test end to end: sign up two users, add friend, create PIN, reveal balance, chat, send aura, check both balances.
- TODO: Settings screen with a Light/Dark toggle that sets `data-theme` on `<html>` (persist in a cookie so the server renders it without a flash).
- Possible next features: forgot/reset PIN, transaction history screen, login rate limiting.
