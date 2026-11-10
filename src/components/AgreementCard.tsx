"use client";

import { useState } from "react";
import type { Artist, ConsignmentAgreement } from "@/types";
import { AgreementText } from "@/components/AgreementText";
import { shortDate } from "@/components/ui";

export function AgreementCard({
  agreement,
  artist,
  busy,
  onRead,
}: {
  agreement: ConsignmentAgreement;
  artist: Artist | undefined;
  busy: boolean;
  onRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { terms } = agreement;
  return (
    <article className="flex flex-col rounded-md border border-line bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{artist?.name}</p>
          <p className="text-xs text-muted">
            Consignment agreement, signed {shortDate(agreement.signedOn)}
          </p>
        </div>
        <span
          className={`text-[11px] font-medium ${terms ? "text-trust" : "text-muted"}`}
        >
          {terms ? "Read by agent" : "Not read"}
        </span>
      </header>

      {terms ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[11px] text-muted">Artist share</dt>
            <dd className="num text-xl font-medium text-trust">
              {terms.artistShareBps / 100}%
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Pay artist within</dt>
            <dd className="num text-xl font-medium">{terms.payoutDays} days</dd>
          </div>
          {terms.notes.length > 0 && (
            <div className="col-span-2">
              <dt className="text-[11px] text-muted">Also in the agreement</dt>
              <dd>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[13px] text-ink/80">
                  {terms.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          Nothing by {artist?.name.split(" ")[0]} can sell until the agent has
          read this agreement and the split is on file.
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-3">
        {!terms && (
          <button
            type="button"
            disabled={busy}
            onClick={onRead}
            className="rounded bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Read with agent
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline"
          aria-expanded={open}
        >
          {open ? "Hide agreement" : "Show agreement"}
        </button>
        {agreement.termsSource && (
          <span className="ml-auto text-[11px] text-faint">
            {agreement.termsSource === "model"
              ? "gpt-oss-20b, local"
              : "cached answer"}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded border border-line bg-row p-3">
          <AgreementText
            text={agreement.text}
            citations={terms?.citations ?? []}
          />
        </div>
      )}
    </article>
  );
}
