"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/gallery", label: "Gallery" },
  { href: "/books", label: "Books" },
  { href: "/artist", label: "Artists" },
  { href: "/lab", label: "Agreement reader" },
  { href: "/demo", label: "Simulator" },
  { href: "/present", label: "Present" },
];

export function Nav({ rampConnected }: { rampConnected?: boolean }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link
          href="/gallery"
          className="text-[15px] font-semibold tracking-tight"
        >
          Rescrow
        </Link>
        <nav className="flex gap-0.5 text-sm">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2.5 py-1 ${active ? "bg-row font-medium text-ink" : "text-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {rampConnected !== undefined && (
          <span className="ml-auto text-xs text-muted">
            {rampConnected
              ? "Ramp Checking ··4417 linked"
              : "No Ramp account linked"}
          </span>
        )}
      </div>
    </header>
  );
}
