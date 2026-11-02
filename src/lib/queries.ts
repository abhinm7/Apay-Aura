import { db } from "./db";
import { leagueStatus } from "./league";
import { APPROVAL_WAIT_MS, INSTANT_APPROVAL_PERCENT, loanQuote, WEEK_MS, type Bank, type BankInput, type Loan } from "./loans";
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

const toLoan = (r: Row): Loan => ({
  id: String(r.id),
  bank: r.bank,
  amount: r.amount,
  interest: r.interest,
  months: r.months,
  fees: r.fees,
  received: r.received,
  total: r.total,
  weeks: r.weeks,
  emi: r.emi,
  emisPaid: r.emis_paid,
  instantFee: r.instant_fee,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
  approveAt: new Date(r.approve_at).toISOString(),
  approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
  closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
});

export async function listLoans(me: string): Promise<Loan[]> {
  const rows = await db()`SELECT * FROM loans WHERE user_id = ${me} ORDER BY id DESC`;
  return rows.map(toLoan);
}

// What decides whether a loan application is allowed.
export async function getLoanEligibility(me: string) {
  const rows = await db()`SELECT balance, verified FROM users WHERE id = ${me}`;
  return rows[0] ? { balance: rows[0].balance as number, verified: rows[0].verified as boolean } : null;
}

// Returns the new pending loan, or null if one with this bank is already pending or ongoing.
export async function applyLoan(me: string, bank: Bank, amount: number) {
  const q = loanQuote(amount, bank);
  try {
    const rows = await db()`
      INSERT INTO loans (user_id, bank, amount, interest, months, fees, received, total, weeks, emi, approve_at)
      VALUES (${me}, ${bank.id}, ${amount}, ${bank.interest}, ${bank.months}, ${q.totalFees}, ${q.received},
              ${q.total}, ${q.weeks}, ${q.emi}, now() + ${`${APPROVAL_WAIT_MS / 1000} seconds`}::interval)
      RETURNING *`;
    return toLoan(rows[0]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return null;
    throw e;
  }
}

// Brings `me`'s loans up to date: approves (and pays out) pending loans whose wait is
// over, then takes every weekly EMI that has come due, closing fully repaid loans.
// EMIs are taken even if the balance goes negative. Call it before anything reads
// the balance. Each step claims the loan rows first, so concurrent calls can't
// pay out or charge twice.
export async function settleLoans(me: string) {
  await db()`
    WITH approved AS (
      UPDATE loans SET status = 'ongoing', approved_at = approve_at
      WHERE user_id = ${me} AND status = 'pending' AND approve_at <= now()
      RETURNING received
    )
    UPDATE users SET balance = balance + (SELECT sum(received) FROM approved)
    WHERE id = ${me} AND EXISTS (SELECT 1 FROM approved)`;

  await db()`
    WITH due AS (
      SELECT id, emis_paid AS before,
             LEAST(weeks, floor(extract(epoch FROM now() - approved_at) / ${WEEK_MS / 1000}::numeric)::integer) AS after
      FROM loans WHERE user_id = ${me} AND status = 'ongoing'
    ), charged AS (
      UPDATE loans l SET
        emis_paid = d.after,
        status    = CASE WHEN d.after >= l.weeks THEN 'closed' ELSE 'ongoing' END,
        closed_at = CASE WHEN d.after >= l.weeks THEN l.approved_at + l.weeks * interval '1 week' END
      FROM due d
      WHERE l.id = d.id AND l.emis_paid = d.before AND d.after > d.before
      RETURNING (CASE WHEN d.after >= l.weeks THEN l.total ELSE d.after * l.emi END) - d.before * l.emi AS amount
    )
    UPDATE users SET balance = balance - (SELECT sum(amount) FROM charged)
    WHERE id = ${me} AND EXISTS (SELECT 1 FROM charged)`;
}

// Skips the wait on a pending loan: takes the instant-approval fee and pays out the
// loan. Returns an error message, or null on success.
export async function approveLoanNow(me: string, loanId: string) {
  const rows = await db()`
    WITH claimed AS (
      UPDATE loans SET status = 'ongoing', approved_at = now(), instant_fee = amount * ${INSTANT_APPROVAL_PERCENT}::integer / 100
      WHERE id = ${loanId} AND user_id = ${me} AND status = 'pending'
        AND (SELECT balance FROM users WHERE id = ${me}) >= amount * ${INSTANT_APPROVAL_PERCENT}::integer / 100
      RETURNING instant_fee, received
    )
    UPDATE users u SET balance = balance - c.instant_fee + c.received
    FROM claimed c WHERE u.id = ${me}
    RETURNING u.id`;
  if (rows.length) return null;
  const [loan] = await db()`SELECT status FROM loans WHERE id = ${loanId} AND user_id = ${me}`;
  if (!loan) return "Loan not found";
  if (loan.status !== "pending") return "This loan is already approved";
  return "Not enough aura for the instant approval fee";
}

// Withdraws a loan that hasn't been approved yet (no aura has moved). Returns false if
// it's gone or already approved.
export async function cancelLoan(me: string, loanId: string) {
  const rows = await db()`
    DELETE FROM loans WHERE id = ${loanId} AND user_id = ${me} AND status = 'pending' RETURNING id`;
  return rows.length > 0;
}

const toBank = (r: Row): Bank => ({
  id: r.id,
  name: r.name,
  interest: r.interest,
  upTo: r.up_to,
  months: r.months,
  verified: r.verified,
  logoUrl: r.logo_url,
  active: r.active,
});

// Every bank, hidden ones included (old loans still need their names), oldest first.
export async function listBanks(): Promise<Bank[]> {
  const rows = await db()`SELECT * FROM banks ORDER BY created_at, id`;
  return rows.map(toBank);
}

export async function getBank(id: string) {
  const rows = await db()`SELECT * FROM banks WHERE id = ${id}`;
  return rows[0] ? toBank(rows[0]) : null;
}

export async function createBank(b: BankInput) {
  const id = `b${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const rows = await db()`
    INSERT INTO banks (id, name, interest, up_to, months, verified, active)
    VALUES (${id}, ${b.name}, ${b.interest}, ${b.upTo}, ${b.months}, ${b.verified}, ${b.active})
    RETURNING *`;
  return toBank(rows[0]);
}

export async function updateBank(id: string, b: BankInput) {
  const rows = await db()`
    UPDATE banks SET name = ${b.name}, interest = ${b.interest}, up_to = ${b.upTo}, months = ${b.months},
                     verified = ${b.verified}, active = ${b.active}
    WHERE id = ${id} RETURNING *`;
  return rows[0] ? toBank(rows[0]) : null;
}

// Saves the new logo URL (or NULL) and returns the one it replaced, or undefined if
// there's no such bank.
export async function setBankLogo(id: string, url: string | null) {
  const rows = await db()`
    UPDATE banks b SET logo_url = ${url}
    FROM (SELECT logo_url FROM banks WHERE id = ${id}) old
    WHERE b.id = ${id}
    RETURNING old.logo_url AS previous`;
  return rows[0] ? ((rows[0].previous as string | null) ?? null) : undefined;
}

// Loans per bank by status, for the admin page.
export async function loanCountsByBank() {
  const rows = await db()`SELECT bank, status, count(*)::integer AS n FROM loans GROUP BY bank, status`;
  const counts: Record<string, Partial<Record<Loan["status"], number>>> = {};
  for (const r of rows) (counts[r.bank] ??= {})[r.status as Loan["status"]] = r.n;
  return counts;
}
