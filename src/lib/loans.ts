// Aura loan rules. Shared by the loans page, the admin page and the API routes.

// Banks live in the `banks` table and are edited at /admin. `interest` is % per month
// (simple interest); `upTo` is the most aura you can borrow.
export type Bank = {
  id: string;
  name: string;
  interest: number;
  upTo: number;
  months: number;
  verified: boolean;
  logoUrl: string | null;
  // Hidden banks stay listed for their existing loans but can't be applied to.
  active: boolean;
};

// You can borrow at most this many times your current balance.
export const MAX_BALANCE_MULTIPLE = 10;

// Loans over 50,000 aura or longer than 3 months need a verified account.
export const VERIFY_ABOVE_AMOUNT = 50_000;
export const VERIFY_ABOVE_MONTHS = 3;
export const needsVerification = (amount: number, months: number) =>
  amount > VERIFY_ABOVE_AMOUNT || months > VERIFY_ABOVE_MONTHS;

// Amounts are picked, not typed: these shares of the most you can borrow, rounded down to 100.
export const AMOUNT_STEP = 100;
export const AMOUNT_PERCENTS = [100, 75, 50, 25, 10];

export function maxLoan(bank: Bank, balance: number) {
  return Math.max(0, Math.min(bank.upTo, balance * MAX_BALANCE_MULTIPLE));
}

export function amountOptions(max: number) {
  const amounts = AMOUNT_PERCENTS.map((p) => Math.floor((max * p) / 100 / AMOUNT_STEP) * AMOUNT_STEP);
  return [...new Set(amounts)].filter((a) => a > 0);
}

// Taken from the payout, as % of the amount (each floored to whole aura).
export const LOAN_FEES = [
  { label: "Aura tax", percent: 6 },
  { label: "Processing fee", percent: 2 },
  { label: "GST", percent: 1 },
  { label: "Platform fee", percent: 1 },
];

export const WEEKS_PER_MONTH = 4;

// Everything about a loan of `amount` from `bank`. db/schema.sql's backfill repeats this maths.
export function loanQuote(amount: number, bank: Pick<Bank, "interest" | "months">) {
  const fees = LOAN_FEES.map((f) => ({ ...f, value: Math.floor((amount * f.percent) / 100) }));
  const totalFees = fees.reduce((sum, f) => sum + f.value, 0);
  const interest = Math.round((amount * bank.interest * bank.months) / 100);
  const total = amount + interest;
  const weeks = bank.months * WEEKS_PER_MONTH;
  const emi = Math.ceil(total / weeks);
  return { fees, totalFees, received: amount - totalFees, interest, total, weeks, emi, lastEmi: total - emi * (weeks - 1) };
}

// Pending loans are approved automatically after this long...
export const APPROVAL_WAIT_MS = 2 * 60 * 1000;
// ...or straight away for this % of the amount.
export const INSTANT_APPROVAL_PERCENT = 5;
export const instantFee = (amount: number) => Math.floor((amount * INSTANT_APPROVAL_PERCENT) / 100);

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type LoanStatus = "pending" | "ongoing" | "closed";

export type Loan = {
  id: string;
  bank: string;
  amount: number;
  interest: number;
  months: number;
  fees: number;
  received: number;
  total: number;
  weeks: number;
  emi: number;
  emisPaid: number;
  instantFee: number;
  status: LoanStatus;
  createdAt: string;
  approveAt: string;
  approvedAt: string | null;
  closedAt: string | null;
};

// Aura repaid after `paid` EMIs (the last EMI absorbs the rounding).
export const repaidAfter = (loan: Pick<Loan, "emi" | "weeks" | "total">, paid: number) =>
  paid >= loan.weeks ? loan.total : paid * loan.emi;

// What the admin page can set on a bank.
export type BankInput = Pick<Bank, "name" | "interest" | "upTo" | "months" | "verified" | "active">;

// Reads a BankInput from a JSON request body.
export function bankInput(body: Record<string, unknown>): BankInput {
  return {
    name: typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "",
    interest: Number(body.interest),
    upTo: Number(body.upTo),
    months: Number(body.months),
    verified: body.verified === true,
    active: body.active === true,
  };
}

export function validateBank(b: BankInput): string | null {
  if (b.name.length < 2 || b.name.length > 40) return "Name must be 2–40 characters";
  if (!Number.isInteger(b.interest) || b.interest < 0 || b.interest > 100) return "Interest must be 0–100% a month";
  if (!Number.isInteger(b.upTo) || b.upTo < AMOUNT_STEP || b.upTo > 10_000_000) {
    return `Limit must be ${AMOUNT_STEP}–1,00,00,000 aura`;
  }
  if (!Number.isInteger(b.months) || b.months < 1 || b.months > 24) return "Tenure must be 1–24 months";
  return null;
}
