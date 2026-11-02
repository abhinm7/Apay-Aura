import type { LoanStatus } from "@/lib/loans";

const COPY: Record<LoanStatus, { title: string; body: string }> = {
  pending: { title: "Nothing pending", body: "Loans you apply for wait here until they're approved." },
  ongoing: { title: "No active loans", body: "Approved loans show up here with their due date." },
  closed: { title: "No closed loans yet", body: "Loans you've fully repaid are kept here." },
};

// Empty tab: a small animated illustration, a line of copy, and a way back to the offers.
export default function LoansEmpty({ status, onBrowse }: { status: LoanStatus; onBrowse: () => void }) {
  const { title, body } = COPY[status];
  return (
    <div className="animate-fade flex flex-col items-center px-8 pt-12 text-center">
      <svg viewBox="0 0 120 120" width={148} height={148} aria-hidden>
        <circle cx={60} cy={64} r={44} className="fill-accent-soft" />
        <Sparkle x={22} y={34} size={6} delay={0} />
        <Sparkle x={100} y={28} size={4.5} delay={0.8} />
        <Sparkle x={104} y={90} size={5.5} delay={1.6} />
        <Sparkle x={16} y={92} size={3.5} delay={1.2} />
        {status === "pending" && <Hourglass />}
        {status === "ongoing" && <Coins />}
        {status === "closed" && <Receipt />}
      </svg>
      <h2 className="mt-2 text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-60 text-sm text-muted">{body}</p>
      {status !== "closed" && (
        <button
          type="button"
          onClick={onBrowse}
          className="mt-6 rounded-full bg-accent-soft px-5 py-2 text-sm font-semibold text-accent active:opacity-80"
        >
          Browse loans
        </button>
      )}
    </div>
  );
}

// Four-point aura star that gently twinkles.
function Sparkle({ x, y, size: s, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <path
      d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`}
      className="twinkle fill-brand-light"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function Hourglass() {
  return (
    <g className="float">
      <path
        d="M44 36C44 52 56 56 56 62C56 68 44 72 44 88H76C76 72 64 68 64 62C64 56 76 52 76 36Z"
        className="fill-surface stroke-accent"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d="M49 44H71C69 52 62 55 60 58C58 55 51 52 49 44Z" className="fill-brand-light" />
      <path d="M48 86C50 78 56 76 60 74C64 76 70 78 72 86Z" className="fill-brand-light" />
      <line x1={60} y1={59} x2={60} y2={75} className="sand-fall stroke-brand-light" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 4" />
      <rect x={38} y={30} width={44} height={6} rx={3} className="fill-accent" />
      <rect x={38} y={88} width={44} height={6} rx={3} className="fill-accent" />
    </g>
  );
}

function Coins() {
  const coin = (y: number) => (
    <g key={y}>
      <path d={`M40 ${y}v6a20 5 0 0 0 40 0v-6`} className="fill-surface stroke-accent" strokeWidth={2.5} />
      <ellipse cx={60} cy={y} rx={20} ry={5} className="fill-surface stroke-accent" strokeWidth={2.5} />
    </g>
  );
  return (
    <>
      {[82, 73, 64].map(coin)}
      <g className="float">
        <circle cx={60} cy={36} r={14} className="fill-accent" />
        <path d="M60 29Q60 36 67 36Q60 36 60 43Q60 36 53 36Q60 36 60 29Z" className="fill-on-accent" />
      </g>
    </>
  );
}

function Receipt() {
  return (
    <>
      <path
        d="M42 30H78V90L72 86L66 90L60 86L54 90L48 86L42 90Z"
        className="fill-surface stroke-accent"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <rect x={50} y={42} width={20} height={3} rx={1.5} className="fill-line" />
      <rect x={50} y={51} width={14} height={3} rx={1.5} className="fill-line" />
      <rect x={50} y={60} width={18} height={3} rx={1.5} className="fill-line" />
      <g className="float">
        <circle cx={78} cy={82} r={12} className="fill-success" />
        <path d="M72.5 82l3.5 3.5 6.5-7" fill="none" className="stroke-on-accent" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}
