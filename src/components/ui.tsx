import type { ReactNode } from "react";
import type { Artwork, HoldStatus, SaleStatus } from "@/types";
import { formatCents } from "@/lib/money";

export function Money({
  cents,
  className = "",
}: {
  cents: number;
  className?: string;
}) {
  return <span className={`num ${className}`}>{formatCents(cents)}</span>;
}

export function Swatch({
  artwork,
  size = 40,
}: {
  artwork: Pick<Artwork, "swatch" | "title">;
  size?: number;
}) {
  const [a, b] = artwork.swatch;
  return (
    <span
      role="img"
      aria-label={artwork.title}
      className="inline-block shrink-0 rounded-sm border border-line"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a} 0 55%, ${b} 55% 100%)`,
      }}
    />
  );
}

const PILL: Record<SaleStatus | HoldStatus | "consigned" | "returned", string> =
  {
    open: "bg-gallery-soft text-gallery",
    paid: "bg-paid-soft text-paid",
    cancelled: "bg-line text-muted",
    locked: "bg-lock-soft text-lock",
    refunded: "bg-line text-muted",
    consigned: "bg-card text-muted border border-line",
    returned: "bg-line text-muted",
  };

const PILL_LABEL: Partial<Record<keyof typeof PILL, string>> = {
  open: "in progress",
  locked: "locked for artist",
  paid: "paid",
};

export function Pill({ status }: { status: keyof typeof PILL }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PILL[status]}`}
    >
      {PILL_LABEL[status] ?? status}
    </span>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  cents,
  tone,
  hint,
}: {
  label: string;
  cents: number;
  tone: "lock" | "gallery" | "paid";
  hint: string;
}) {
  const color = {
    lock: "text-lock",
    gallery: "text-gallery",
    paid: "text-paid",
  }[tone];
  const bar = { lock: "bg-lock", gallery: "bg-gallery", paid: "bg-paid" }[tone];
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-card p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${color}`}>
        <Money cents={cents} />
      </p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
