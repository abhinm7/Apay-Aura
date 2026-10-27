import { db } from "./db";

export type User = { id: string; name: string; handle: string; hasPin: boolean; verified: boolean };
export type Friend = { name: string; handle: string; verified: boolean };
export type Message = {
  id: string;
  mine: boolean;
  kind: "text" | "payment";
  body: string;
  amount: number | null;
  createdAt: string;
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  hasPin: r.has_pin,
  verified: r.verified,
});

const toMessage = (r: Row): Message => ({
  id: String(r.id),
  mine: r.mine,
  kind: r.kind,
  body: r.body,
  amount: r.amount,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function getUserById(id: string) {
  const rows = await db()`
    SELECT id, name, handle, verified, pin_hash IS NOT NULL AS has_pin FROM users WHERE id = ${id}`;
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserByHandle(handle: string) {
  const rows = await db()`
    SELECT id, name, handle, verified, pin_hash IS NOT NULL AS has_pin FROM users
    WHERE handle = ${handle.toLowerCase()}`;
  return rows[0] ? toUser(rows[0]) : null;
}

// Most recently active friends first, like the "People" row in GPay.
export async function listFriends(me: string): Promise<Friend[]> {
  const rows = await db()`
    SELECT u.name, u.handle, u.verified,
           COALESCE((SELECT max(m.created_at) FROM messages m
                     WHERE (m.sender_id = ${me} AND m.receiver_id = u.id)
                        OR (m.sender_id = u.id AND m.receiver_id = ${me})), f.created_at) AS active_at
    FROM friendships f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ${me}
    ORDER BY active_at DESC`;
  return rows.map((r) => ({ name: r.name, handle: r.handle, verified: r.verified }));
}

export async function searchUsers(me: string, q: string) {
  const digits = q.replace(/\D/g, "");
  const rows = await db()`
    SELECT u.name, u.handle, u.verified,
           EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = ${me} AND f.friend_id = u.id) AS is_friend
    FROM users u
    WHERE u.id <> ${me}
      AND (u.handle ILIKE ${q + "%"} OR u.name ILIKE ${"%" + q + "%"}
           OR (${digits.length === 10} AND u.phone = ${digits}))
    ORDER BY u.handle ILIKE ${q + "%"} DESC, u.name
    LIMIT 20`;
  return rows.map((r) => ({
    name: r.name as string,
    handle: r.handle as string,
    verified: r.verified as boolean,
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
        SELECT id, sender_id = ${me} AS mine, kind, body, amount, created_at FROM messages
        WHERE ((sender_id = ${me} AND receiver_id = ${other}) OR (sender_id = ${other} AND receiver_id = ${me}))
          AND id > ${afterId}
        ORDER BY id`
    : await db()`
        SELECT * FROM (
          SELECT id, sender_id = ${me} AS mine, kind, body, amount, created_at FROM messages
          WHERE (sender_id = ${me} AND receiver_id = ${other}) OR (sender_id = ${other} AND receiver_id = ${me})
          ORDER BY id DESC LIMIT 100
        ) recent ORDER BY id`;
  return rows.map(toMessage);
}

export type Payment = {
  id: string;
  sent: boolean;
  amount: number;
  note: string;
  createdAt: string;
  other: Friend;
};

// All aura sent and received, newest first.
export async function listPayments(me: string, limit = 200): Promise<Payment[]> {
  const rows = await db()`
    SELECT m.id, m.sender_id = ${me} AS sent, m.amount, m.body, m.created_at,
           u.name, u.handle, u.verified
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ${me} THEN m.receiver_id ELSE m.sender_id END
    WHERE m.kind = 'payment' AND (m.sender_id = ${me} OR m.receiver_id = ${me})
    ORDER BY m.id DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: String(r.id),
    sent: r.sent,
    amount: r.amount,
    note: r.body,
    createdAt: new Date(r.created_at).toISOString(),
    other: { name: r.name, handle: r.handle, verified: r.verified },
  }));
}

export async function insertTextMessage(from: string, to: string, body: string) {
  const rows = await db()`
    INSERT INTO messages (sender_id, receiver_id, kind, body) VALUES (${from}, ${to}, 'text', ${body})
    RETURNING id, true AS mine, kind, body, amount, created_at`;
  return toMessage(rows[0]);
}

// Debit, credit and the payment message happen in one statement, so the
// transfer is atomic and the balance check can't race with another payment.
export async function transferAura(from: string, to: string, amount: number, note: string) {
  const rows = await db()`
    WITH debit AS (
      UPDATE users SET balance = balance - ${amount}
      WHERE id = ${from} AND balance >= ${amount}
      RETURNING balance
    ), credit AS (
      UPDATE users SET balance = balance + ${amount}
      WHERE id = ${to} AND EXISTS (SELECT 1 FROM debit)
      RETURNING id
    ), msg AS (
      INSERT INTO messages (sender_id, receiver_id, kind, body, amount)
      SELECT ${from}::uuid, ${to}::uuid, 'payment', ${note}, ${amount}::integer
      WHERE EXISTS (SELECT 1 FROM debit)
      RETURNING id, true AS mine, kind, body, amount, created_at
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
