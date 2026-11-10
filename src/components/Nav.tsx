"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/gallery", label: "Gallery" },
  { href: "/artist", label: "Artists" },
  { href: "/demo", label: "Demo controls" },
];

export function Nav({ rampConnected }: { rampConnected?: boolean }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/gallery" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight">
            Rescrow
          </span>
          <span className="hidden text-xs text-muted sm:inline">
            artists&apos; money, locked on arrival
          </span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 ${active ? "bg-ink text-paper" : "text-muted hover:bg-line/60 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {rampConnected !== undefined && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted">
            <span
              className={`h-2 w-2 rounded-full ${rampConnected ? "bg-lock" : "bg-danger"}`}
            />
            {rampConnected ? "Ramp account connected" : "Ramp not connected"}
          </span>
        )}
      </div>
    </header>
  );
}
