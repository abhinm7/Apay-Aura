CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  phone            text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  handle           text NOT NULL UNIQUE,
  pin_hash         text,
  pin_failed       integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  balance          integer NOT NULL DEFAULT 1000 CHECK (balance >= 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- One row per direction, so each side sees the other in their list.
CREATE TABLE IF NOT EXISTS friendships (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id          bigserial PRIMARY KEY,
  sender_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('text', 'payment')),
  body        text NOT NULL DEFAULT '',
  amount      integer CHECK (amount IS NULL OR amount > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages (sender_id, receiver_id, id);

-- Set manually in the DB; shows a verified badge next to the name.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- One row per browser/device that turned on notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Aura tax taken from a payment (see src/lib/tax.ts). Receiver got amount - tax.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tax integer NOT NULL DEFAULT 0 CHECK (tax >= 0);

-- Every Aura ID, including each user's main one (users.handle). The primary key
-- keeps IDs unique across all accounts. Up to 3 per user (enforced in code).
CREATE TABLE IF NOT EXISTS aura_ids (
  handle     text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aura_ids_user_idx ON aura_ids (user_id);

-- Backfill main IDs for accounts created before aura_ids existed.
INSERT INTO aura_ids (handle, user_id, created_at)
SELECT handle, id, created_at FROM users
ON CONFLICT (handle) DO NOTHING;

-- Last message each user has read in each chat (drives the unread dot).
CREATE TABLE IF NOT EXISTS chat_reads (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, friend_id)
);

-- Existing chats start as read, so old messages don't all show as new.
INSERT INTO chat_reads (user_id, friend_id, last_read_id)
SELECT f.user_id, f.friend_id,
       COALESCE((SELECT max(m.id) FROM messages m WHERE m.sender_id = f.friend_id AND m.receiver_id = f.user_id), 0)
FROM friendships f
ON CONFLICT DO NOTHING;

-- "typing…" / "attempting to pay…": a heartbeat the client refreshes every few
-- seconds while it's happening. Rows older than a few seconds are ignored.
CREATE TABLE IF NOT EXISTS chat_activity (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('typing', 'paying')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
