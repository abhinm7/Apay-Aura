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

-- Profile picture: a public Vercel Blob URL (see /api/profile/avatar). NULL shows initials.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Bought verified badges (see /profile/verify): the details given and the fee paid.
-- Paying the fee and setting users.verified happen in one statement (buyVerification()).
CREATE TABLE IF NOT EXISTS verifications (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  address        text NOT NULL,
  occupation     text NOT NULL CHECK (occupation IN ('employed', 'salaried', 'student')),
  monthly_income integer NOT NULL CHECK (monthly_income >= 0),
  fee            integer NOT NULL CHECK (fee >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Aura loans (see src/lib/loans.ts). Applying creates a 'pending' row; approval
-- ('ongoing') and closing are done manually in the DB for now. Interest and
-- tenure are copied from the offer at the time of applying.
CREATE TABLE IF NOT EXISTS loans (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank        text NOT NULL,
  amount      integer NOT NULL CHECK (amount > 0),
  interest    integer NOT NULL CHECK (interest >= 0),
  months      integer NOT NULL CHECK (months > 0),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ongoing', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  closed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS loans_user_idx ON loans (user_id, id);
-- One open (pending or ongoing) loan per bank per user.
CREATE UNIQUE INDEX IF NOT EXISTS loans_open_idx ON loans (user_id, bank) WHERE status IN ('pending', 'ongoing');

-- Loan v2: fees taken from the payout, weekly EMIs, auto-approval after 2 minutes
-- (or instantly for a 5% fee). See src/lib/loans.ts and settleLoans().
-- fees: tax + processing + GST + platform. received: amount - fees, credited on
-- approval. total: amount + interest, repaid by `weeks` weekly EMIs of `emi` (the
-- last one is total - emi * (weeks - 1)). approve_at: auto-approval time.
-- instant_fee: paid to skip the wait.
ALTER TABLE loans ADD COLUMN IF NOT EXISTS fees        integer NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS received    integer NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total       integer NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS weeks       integer NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS emi         integer NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS emis_paid   integer NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS approve_at  timestamptz;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS instant_fee integer NOT NULL DEFAULT 0;

-- Fill those in for loans applied for before they existed (same maths as loanQuote()).
UPDATE loans SET
  fees       = amount * 6 / 100 + amount * 2 / 100 + amount / 100 + amount / 100,
  received   = amount - (amount * 6 / 100 + amount * 2 / 100 + amount / 100 + amount / 100),
  total      = amount + round(amount * interest * months / 100.0)::integer,
  weeks      = months * 4,
  emi        = ceil((amount + round(amount * interest * months / 100.0)) / (months * 4.0))::integer,
  approve_at = COALESCE(approve_at, created_at + interval '2 minutes')
WHERE weeks = 0;

-- EMIs are taken even when they push the balance below zero. Payments and the
-- verified badge still check the balance themselves.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_balance_check;

-- Loan banks, edited at /admin. Loans copy interest/tenure when applied for, so
-- edits only affect new loans. Hidden (active = false) banks can't be applied to.
CREATE TABLE IF NOT EXISTS banks (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  interest   integer NOT NULL CHECK (interest >= 0),
  up_to      integer NOT NULL CHECK (up_to > 0),
  months     integer NOT NULL CHECK (months > 0),
  verified   boolean NOT NULL DEFAULT false,
  logo_url   text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The original built-in offers.
INSERT INTO banks (id, name, interest, up_to, months, verified, created_at) VALUES
  ('abi', 'Aura Bank of India', 10, 50000, 3, false, '2026-11-01 00:00:01+00'),
  ('apay', 'apay Official', 8, 25000, 2, true, '2026-11-01 00:00:02+00'),
  ('syndicate', 'Aura Syndicate', 12, 100000, 6, false, '2026-11-01 00:00:03+00'),
  ('auriano', 'Auriano', 15, 20000, 1, false, '2026-11-01 00:00:04+00'),
  ('acl', 'Aura Corporation Limited', 9, 75000, 4, false, '2026-11-01 00:00:05+00')
ON CONFLICT (id) DO NOTHING;

-- Wrong admin PIN attempts (one row; see src/lib/admin.ts).
CREATE TABLE IF NOT EXISTS admin_lock (
  id           integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  failed       integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);

-- Aura betting: best-of-3 tic-tac-toe for a stake (see src/lib/bet.ts). Each player's
-- stake is taken when they commit (challenge / accept); the pot goes to the winner,
-- or back to both on a tie. `version` guards every update against races.
CREATE TABLE IF NOT EXISTS bets (
  id              bigserial PRIMARY KEY,
  challenger_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake           integer NOT NULL CHECK (stake > 0),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'finished', 'declined', 'cancelled')),
  board           text NOT NULL DEFAULT '.........',
  round           integer NOT NULL DEFAULT 1,
  turn_id         uuid,
  turn_deadline   timestamptz,
  challenger_wins integer NOT NULL DEFAULT 0,
  opponent_wins   integer NOT NULL DEFAULT 0,
  last_board      text,
  last_result     text CHECK (last_result IN ('challenger', 'opponent', 'draw')),
  winner_id       uuid,
  forfeit_by      uuid,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bets_challenger_idx ON bets (challenger_id, id);
CREATE INDEX IF NOT EXISTS bets_opponent_idx ON bets (opponent_id, id);

-- Challenges show up in chat as a 'bet' message pointing at the bet.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS bet_id bigint REFERENCES bets(id) ON DELETE CASCADE;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text', 'payment', 'bet'));
