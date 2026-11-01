import { db } from "./db";
import { leagueStatus } from "./league";
import { auraTax } from "./tax";
import { VERIFY_FEE, type Occupation } from "./verification";

export type User = {
  id: string;
  name: string;
  handle: string;
  hasPin: boolean;
  verified: boolean;
  avatarUrl: string | null;
};
export type Friend = { name: string; handle: string; verified: boolean; avatarUrl: string | null; unread?: boolean };
export type Activity = "typing" | "paying";
export type Message = {
  id: string;
  mine: boolean;
  kind: "text" | "payment";
  body: string;
  amount: number | null;
  tax: number;
  createdAt: string;
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  hasPin: r.has_pin,
  verified: r.verified,
  avatarUrl: r.avatar_url,
});

const toMessage = (r: Row): Message => ({
  id: String(r.id),
  mine: r.mine,
  kind: r.kind,
  body: r.body,
  amount: r.amount,
  tax: r.tax ?? 0,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function getUserById(id: string) {
  const rows = await db()`
    SELECT id, name, handle, verified, avatar_url, pin_hash IS NOT NULL AS has_pin FROM users WHERE id = ${id}`;
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getLeague(id: string) {
  const rows = await db()`SELECT balance FROM users WHERE id = ${id}`;
  return leagueStatus(rows[0]?.balance ?? 0);
}

// Finds a user by any of their Aura IDs; the result's handle is their main one.
export async function getUserByHandle(handle: string) {
  const rows = await db()`
    SELECT u.id, u.name, u.handle, u.verified, u.avatar_url, u.pin_hash IS NOT NULL AS has_pin
    FROM aura_ids a JOIN users u ON u.id = a.user_id
    WHERE a.handle = ${handle.toLowerCase()}`;
  return rows[0] ? toUser(rows[0]) : null;
}

export const MAX_AURA_IDS = 3;

export type Profile = {
  name: string;
  handle: string;
  phone: string;
  verified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  // All Aura IDs, main first.
  auraIds: string[];
};

export async function getProfile(me: string): Promise<Profile | null> {
  const [u] = await db()`
    SELECT name, handle, phone, verified, avatar_url, created_at,
           ARRAY(SELECT a.handle FROM aura_ids a WHERE a.user_id = users.id
                 ORDER BY a.handle = users.handle DESC, a.created_at) AS aura_ids
    FROM users WHERE id = ${me}`;
  if (!u) return null;
  return {
    name: u.name,
    handle: u.handle,
    phone: u.phone,
    verified: u.verified,
    avatarUrl: u.avatar_url,
    createdAt: new Date(u.created_at).toISOString(),
    auraIds: u.aura_ids,
  };
}

// Returns an error message, or null. The insert is a single statement so the
// per-user limit can't be raced, and the primary key keeps IDs unique.
// Saves the new profile picture URL (or NULL) and returns the one it replaced,
// so the caller can delete the old file.
export async function setAvatarUrl(me: string, url: string | null) {
  const rows = await db()`
    UPDATE users u SET avatar_url = ${url}
    FROM (SELECT avatar_url FROM users WHERE id = ${me}) old
    WHERE u.id = ${me}
    RETURNING old.avatar_url AS previous`;
  return (rows[0]?.previous as string | null) ?? null;
}

// Debits the fee, sets the badge and saves the details in one statement, so it
// can't run twice or race with a payment. Needs a profile photo. Returns an
// error message, or null on success.
export async function buyVerification(
  me: string,
  details: { address: string; occupation: Occupation; monthlyIncome: number },
) {
  const rows = await db()`
    WITH paid AS (
      UPDATE users SET balance = balance - ${VERIFY_FEE}, verified = true
      WHERE id = ${me} AND NOT verified AND avatar_url IS NOT NULL AND balance >= ${VERIFY_FEE}
      RETURNING id
    ), saved AS (
      INSERT INTO verifications (user_id, address, occupation, monthly_income, fee)
      SELECT id, ${details.address}, ${details.occupation}, ${details.monthlyIncome}, ${VERIFY_FEE} FROM paid
      ON CONFLICT (user_id) DO UPDATE
        SET address = EXCLUDED.address, occupation = EXCLUDED.occupation,
            monthly_income = EXCLUDED.monthly_income, fee = EXCLUDED.fee, created_at = now()
    )
    SELECT (SELECT count(*) FROM paid) AS paid, verified, avatar_url IS NOT NULL AS has_photo
    FROM users WHERE id = ${me}`;
  const r = rows[0];
  if (!r) return "Account not found";
  if (Number(r.paid)) return null;
  if (r.verified) return "You're already verified";
  if (!r.has_photo) return "Add a profile photo first";
  return `Not enough aura. You need ✦ ${VERIFY_FEE.toLocaleString()}.`;
}

export async function addAuraId(me: string, handle: string) {
  try {
    const rows = await db()`
      INSERT INTO aura_ids (handle, user_id)
      SELECT ${handle}, ${me}::uuid
      WHERE (SELECT count(*) FROM aura_ids WHERE user_id = ${me}) < ${MAX_AURA_IDS}
      RETURNING handle`;
    return rows.length ? null : `You can have up to ${MAX_AURA_IDS} Aura IDs`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return "That Aura ID is taken — try another";
    throw e;
  }
}

// The main ID can't be removed; make another one main first.
export async function removeAuraId(me: string, handle: string) {
  const rows = await db()`
    DELETE FROM aura_ids a USING users u
    WHERE a.handle = ${handle} AND a.user_id = ${me} AND u.id = a.user_id AND u.handle <> a.handle
    RETURNING a.handle`;
  return rows.length ? null : "You can't remove your main Aura ID";
}

export async function setMainAuraId(me: string, handle: string) {
  const rows = await db()`
    UPDATE users SET handle = ${handle}
    WHERE id = ${me} AND EXISTS (SELECT 1 FROM aura_ids WHERE handle = ${handle} AND user_id = ${me})
    RETURNING id`;
  return rows.length ? null : "That isn't one of your Aura IDs";
}

// Most recently active friends first, like the "People" row in GPay.
export async function listFriends(me: string): Promise<Friend[]> {
  const rows = await db()`
    SELECT u.name, u.handle, u.verified, u.avatar_url,
           EXISTS (SELECT 1 FROM messages m
                   WHERE m.sender_id = u.id AND m.receiver_id = ${me}
                     AND m.id > COALESCE((SELECT r.last_read_id FROM chat_reads r
                                          WHERE r.user_id = ${me} AND r.friend_id = u.id), 0)) AS unread,
           COALESCE((SELECT max(m.created_at) FROM messages m
                     WHERE (m.sender_id = ${me} AND m.receiver_id = u.id)
                        OR (m.sender_id = u.id AND m.receiver_id = ${me})), f.created_at) AS active_at
    FROM friendships f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ${me}
    ORDER BY active_at DESC`;
  return rows.map((r) => ({
    name: r.name,
    handle: r.handle,
    verified: r.verified,
    avatarUrl: r.avatar_url,
    unread: r.unread,
  }));
}

// Marks everything `other` has sent `me` so far as read.
export async function markRead(me: string, other: string) {
  await db()`
    INSERT INTO chat_reads (user_id, friend_id, last_read_id)
    SELECT ${me}::uuid, ${other}::uuid,
           COALESCE((SELECT max(id) FROM messages WHERE sender_id = ${other} AND receiver_id = ${me}), 0)
    ON CONFLICT (user_id, friend_id) DO UPDATE
      SET last_read_id = GREATEST(chat_reads.last_read_id, EXCLUDED.last_read_id)`;
}

// How long an activity heartbeat counts as live.
const ACTIVITY_TTL = "6 seconds";

export async function setActivity(me: string, other: string, kind: Activity | null) {
  if (kind) {
    await db()`
      INSERT INTO chat_activity (user_id, friend_id, kind) VALUES (${me}, ${other}, ${kind})
      ON CONFLICT (user_id, friend_id) DO UPDATE SET kind = EXCLUDED.kind, updated_at = now()`;
  } else {
    await db()`DELETE FROM chat_activity WHERE user_id = ${me} AND friend_id = ${other}`;
  }
}

// What `other` is doing in their chat with `me` right now, if anything.
export async function getActivity(other: string, me: string): Promise<Activity | null> {
  const rows = await db()`
    SELECT kind FROM chat_activity
    WHERE user_id = ${other} AND friend_id = ${me} AND updated_at > now() - ${ACTIVITY_TTL}::interval`;
  return (rows[0]?.kind as Activity) ?? null;
}

export async function searchUsers(me: string, q: string) {
  const digits = q.replace(/\D/g, "");
  const rows = await db()`
    SELECT u.name, u.handle, u.verified, u.avatar_url,
           EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = ${me} AND f.friend_id = u.id) AS is_friend
    FROM users u
    WHERE u.id <> ${me}
      AND (EXISTS (SELECT 1 FROM aura_ids a WHERE a.user_id = u.id AND a.handle ILIKE ${q + "%"})
           OR u.name ILIKE ${"%" + q + "%"}
           OR (${digits.length === 10} AND u.phone = ${digits}))
    ORDER BY u.handle ILIKE ${q + "%"} DESC, u.name
    LIMIT 20`;
  return rows.map((r) => ({
    name: r.name as string,
    handle: r.handle as string,
    verified: r.verified as boolean,
    avatarUrl: r.avatar_url as string | null,
    isFriend: r.is_friend as boolean,
  }));
}

export async function addFriendship(a: string, b: string) {
  await db()`
    INSERT INTO friendships (user_id, friend_id) VALUES (${a}, ${b}), (${b}, ${a})
    ON CONFLICT DO NOTHING`;
}

export async function listMessages(me: string, other: string, afterId?: string) {
  const rows = afterId
    ? await db()`
        SELECT id, sender_id = ${me} AS mine, kind, body, amount, tax, created_at FROM messages
        WHERE ((sender_id = ${me} AND receiver_id = ${other}) OR (sender_id = ${other} AND receiver_id = ${me}))
          AND id > ${afterId}
        ORDER BY id`
    : await db()`
        SELECT * FROM (
          SELECT id, sender_id = ${me} AS mine, kind, body, amount, tax, created_at FROM messages
          WHERE (sender_id = ${me} AND receiver_id = ${other}) OR (sender_id = ${other} AND receiver_id = ${me})
          ORDER BY id DESC LIMIT 100
        ) recent ORDER BY id`;
  return rows.map(toMessage);
}

export type Payment = {
  id: string;
  sent: boolean;
  amount: number;
  tax: number;
  note: string;
  createdAt: string;
  other: Friend;
};

// All aura sent and received, newest first.
export async function listPayments(me: string, limit = 200): Promise<Payment[]> {
  const rows = await db()`
    SELECT m.id, m.sender_id = ${me} AS sent, m.amount, m.tax, m.body, m.created_at,
           u.name, u.handle, u.verified, u.avatar_url
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ${me} THEN m.receiver_id ELSE m.sender_id END
    WHERE m.kind = 'payment' AND (m.sender_id = ${me} OR m.receiver_id = ${me})
    ORDER BY m.id DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: String(r.id),
    sent: r.sent,
    amount: r.amount,
    tax: r.tax,
    note: r.body,
    createdAt: new Date(r.created_at).toISOString(),
    other: { name: r.name, handle: r.handle, verified: r.verified, avatarUrl: r.avatar_url },
  }));
}

export async function insertTextMessage(from: string, to: string, body: string) {
  const rows = await db()`
    INSERT INTO messages (sender_id, receiver_id, kind, body) VALUES (${from}, ${to}, 'text', ${body})
    RETURNING id, true AS mine, kind, body, amount, tax, created_at`;
  return toMessage(rows[0]);
}

// Debit, credit and the payment message happen in one statement, so the
// transfer is atomic and the balance check can't race with another payment.
// The sender pays `amount`; the receiver is credited `amount - tax`.
export async function transferAura(from: string, to: string, amount: number, note: string) {
  const tax = auraTax(amount);
  const rows = await db()`
    WITH debit AS (
      UPDATE users SET balance = balance - ${amount}
      WHERE id = ${from} AND balance >= ${amount}
      RETURNING balance
    ), credit AS (
      UPDATE users SET balance = balance + ${amount - tax}
      WHERE id = ${to} AND EXISTS (SELECT 1 FROM debit)
      RETURNING id
    ), msg AS (
      INSERT INTO messages (sender_id, receiver_id, kind, body, amount, tax)
      SELECT ${from}::uuid, ${to}::uuid, 'payment', ${note}, ${amount}::integer, ${tax}::integer
      WHERE EXISTS (SELECT 1 FROM debit)
      RETURNING id, true AS mine, kind, body, amount, tax, created_at
    ), link AS (
      INSERT INTO friendships (user_id, friend_id)
      SELECT ${from}::uuid, ${to}::uuid WHERE EXISTS (SELECT 1 FROM debit)
      UNION ALL
      SELECT ${to}::uuid, ${from}::uuid WHERE EXISTS (SELECT 1 FROM debit)
      ON CONFLICT DO NOTHING
    )
    SELECT msg.*, (SELECT balance FROM debit) AS new_balance FROM msg`;
  if (!rows[0]) return null;
  return { message: toMessage(rows[0]), balance: rows[0].new_balance as number };
}
