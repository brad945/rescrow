import type { Artist, ConsignmentAgreement } from "@/types";

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
  const { terms } = agreement;
  return (
    <article className="flex flex-col rounded-lg border border-line bg-card p-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{artist?.name}</p>
          <p className="text-xs text-muted">
            Signed{" "}
            {new Date(agreement.signedOn).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {terms ? (
          <span className="rounded-full bg-lock-soft px-2 py-0.5 text-xs font-medium text-lock">
            read by agent
          </span>
        ) : (
          <span className="rounded-full bg-gallery-soft px-2 py-0.5 text-xs font-medium text-gallery">
            not read yet
          </span>
        )}
      </header>

      {terms ? (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex gap-6">
            <div>
              <p className="num text-2xl font-semibold text-lock">
                {terms.artistShareBps / 100}%
              </p>
              <p className="text-xs text-muted">to the artist</p>
            </div>
            <div>
              <p className="num text-2xl font-semibold">{terms.payoutDays}d</p>
              <p className="text-xs text-muted">legal payout window</p>
            </div>
          </div>
          {terms.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-muted">
              {terms.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {terms.citations.length > 0 && (
            <div className="space-y-1 border-l-2 border-line pl-3 text-xs text-muted italic">
              {terms.citations.map((c) => (
                <p key={c}>&ldquo;{c}&rdquo;</p>
              ))}
            </div>
          )}
          {agreement.termsSource && (
            <p className="text-xs text-muted">
              Source:{" "}
              {agreement.termsSource === "model"
                ? "gpt-oss, live"
                : "saved agent answer"}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-between gap-4 text-sm">
          <p className="line-clamp-4 font-serif text-muted">{agreement.text}</p>
          <button
            type="button"
            disabled={busy}
            onClick={onRead}
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-50"
          >
            Have the agent read it
          </button>
        </div>
      )}
    </article>
  );
}
