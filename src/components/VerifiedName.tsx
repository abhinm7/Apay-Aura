export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="shrink-0" role="img" aria-label="Verified">
      <path
        className="fill-brand-light"
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A name that truncates, with the verified badge kept visible on its right.
export default function VerifiedName({
  name,
  verified,
  className = "",
  badgeSize,
}: {
  name: string;
  verified: boolean;
  className?: string;
  badgeSize?: number;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      <span className="truncate">{name}</span>
      {verified && <VerifiedBadge size={badgeSize} />}
    </span>
  );
}
