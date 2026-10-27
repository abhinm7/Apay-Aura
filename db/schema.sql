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
