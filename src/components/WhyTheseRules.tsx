import { CASES, LIMITS } from "@/lib/cases";
import { Card } from "@/components/ui";

const FLAG = {
  reported: "reported",
  alleged: "alleged",
  out_of_scope: "out of scope",
} as const;

/** The real failures behind Rescrow's rules, the test for each, and its limits. */
export function WhyTheseRules() {
  return (
    <Card title="Why these rules">
      <ul className="divide-y divide-line/60 text-[12px]">
        {CASES.map((c) => (
          <li key={c.name} className="grid gap-1 py-2 md:grid-cols-[1fr_1.3fr]">
            <div>
              <a
                href={c.source}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline decoration-dotted"
              >
                {c.name}, {c.year}
              </a>{" "}
              <span className="rounded-sm border border-line px-1 text-[10px] text-muted">
                {FLAG[c.status]}
              </span>
              <p className="text-muted">{c.what}</p>
            </div>
            <div>
              <p>{c.rule}</p>
              {c.test && (
                <p className="num text-[10px] text-faint">
                  {c.test.file} › {c.test.title}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 mb-1 text-sm font-semibold">
        What this proves, and what it doesn&apos;t
      </h3>
      <ul className="space-y-1 text-[12px]">
        {LIMITS.map((l) => (
          <li key={l.text}>
            <span className={l.proves ? "text-trust" : "text-danger"}>
              {l.proves ? "Proves: " : "Doesn't prove: "}
            </span>
            {l.text}
            {l.test && (
              <span className="num block text-[10px] text-faint">
                {l.test.file} › {l.test.title}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
