import type { ReactNode } from "react";
import type { Artwork, ArtworkStatus, HoldStatus, SaleStatus } from "@/types";
import { formatCents } from "@/lib/money";
import { ArtworkImage } from "@/components/ArtworkImage";

const MINUS = "−";

export function Money({
  cents,
  signed = false,
  className = "",
}: {
  cents: number;
  /** Show + on credits and a true minus on debits, like a bank statement. */
  signed?: boolean;
  className?: string;
}) {
  const abs = formatCents(Math.abs(cents));
  const text =
    cents < 0 ? `${MINUS}${abs}` : signed && cents > 0 ? `+${abs}` : abs;
  return <span className={`num whitespace-nowrap ${className}`}>{text}</span>;
}

export function Swatch({
  artwork,
  size = 40,
}: {
  artwork: Pick<Artwork, "id" | "swatch" | "title">;
  size?: number;
}) {
  return <ArtworkImage artwork={artwork} size={size} />;
}

type Status = SaleStatus | HoldStatus | ArtworkStatus;

const STATUS: Record<Status, { label: string; className: string }> = {
  open: { label: "Paying", className: "text-ink border-ink/25" },
  paid: { label: "Paid", className: "text-muted border-line" },
  cancelled: { label: "Cancelled", className: "text-faint border-line" },
  locked: { label: "In trust", className: "text-trust border-trust/30" },
  refunded: { label: "Refunded", className: "text-faint border-line" },
  consigned: { label: "Available", className: "text-muted border-line" },
  returned: { label: "Returned", className: "text-faint border-line" },
  sold: { label: "Sold", className: "text-muted border-line" },
};

export function Pill({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Let tables run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section
      className={`rounded-md border border-line bg-card ${flush ? "" : "p-4"} ${className}`}
    >
      {(title || action) && (
        <header
          className={`flex items-center justify-between gap-3 ${flush ? "border-b border-line px-4 py-3" : "mb-3"}`}
        >
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const TZ = "America/New_York";

/** "Nov 10, 2:07:52 PM ET": exact, the way a bank shows it. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: TZ,
  });
  return `${date}, ${time} ET`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: TZ,
  });
}

/** Short, stable reference shown next to ledger lines, like a bank trace number. */
export function ref(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}
