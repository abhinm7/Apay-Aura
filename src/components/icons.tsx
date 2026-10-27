import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const EyeIcon = (p: P) => (
  <Base {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const EyeOffIcon = (p: P) => (
  <Base {...p}>
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Base>
);

export const BackIcon = (p: P) => (
  <Base {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Base>
);

export const SendIcon = (p: P) => (
  <Base {...p}>
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </Base>
);

export const SearchIcon = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const CheckIcon = (p: P) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const LogoutIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Base>
);

export const BackspaceIcon = (p: P) => (
  <Base {...p}>
    <path d="M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1ZM17 9l-6 6M11 9l6 6" />
  </Base>
);

export const ScanIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10" />
  </Base>
);

export const QrIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3" />
  </Base>
);

export const HistoryIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </Base>
);

export const LoanIcon = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="9" r="6" />
    <path d="M15.6 9.4A6 6 0 1 1 9.4 15.6M9 6.5v5M6.5 9h5" />
  </Base>
);

export const MenuIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const BellIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Base>
);

export const CloseIcon = (p: P) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

// The aura currency mark.
export const AuraMark = ({ className = "" }: { className?: string }) => (
  <span className={`font-semibold ${className}`} aria-label="aura">
    ✦
  </span>
);
