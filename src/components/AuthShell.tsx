export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-8">
      <div className="mb-10 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-lg text-on-accent">✦</span>
        <Wordmark />
      </div>
      <h1 className="font-display text-[32px] leading-tight font-semibold">{title}</h1>
      <p className="mt-1 mb-8 text-[15px] text-muted">{subtitle}</p>
      {children}
    </main>
  );
}

export function Wordmark() {
  return (
    <span className="text-2xl leading-none font-bold tracking-tight text-brand">
      a<span className="text-brand-light">pay</span>
    </span>
  );
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none placeholder:text-muted focus:border-accent"
        {...props}
      />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="h-12 w-full rounded-2xl bg-accent text-[15px] font-semibold text-on-accent active:opacity-90 disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
