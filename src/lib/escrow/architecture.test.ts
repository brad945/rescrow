// @vitest-environment node
//
// "Only one door out of trust", checked against the source rather than by
// convention. Every line in src/ that writes a hold's status, a payout, the
// gallery's operating balance or a sale/artwork/gallery status is listed here
// with the function it lives in. A new write anywhere (a page, a route, a new
// engine helper) fails this test until someone adds it to the manifest below,
// which makes every new way of moving money a reviewed, visible change.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

const WRITE =
  /(\.status\s*=(?!=)|payouts\.push\(|operatingBalanceCents\s*[-+]?=(?!=)|\.claimedByCreditorsCents\s*=(?!=)|holds\.push\(|journal\.push\(|refunds\.push\(|\.amountCents\s*[-+]?=(?!=))/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
      ? [p]
      : [];
  });
}

// plants.ts corrupts copies on purpose (for /lab's "Try to break the books"),
// so its writes are exempt from the manifest. That file is exempt from this
// scan only; the import guard below keeps it away from routes and the store.
const WRITE_SCAN_EXEMPT = ["lib/escrow/plants.ts"];

function writes(): string[] {
  const out: string[] = [];
  for (const file of files(SRC)) {
    if (WRITE_SCAN_EXEMPT.includes(path.relative(SRC, file))) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    let fn = "(top level)";
    lines.forEach((line) => {
      const m = line.match(/^(?:export )?(?:async )?function (\w+)/);
      if (m) fn = m[1];
      if (WRITE.test(line) && !line.trim().startsWith("//")) {
        const rel = path.relative(SRC, file);
        out.push(`${rel} ${fn}: ${line.trim()}`);
      }
    });
  }
  return out.sort();
}

// The complete list of places that move money or change a money-bearing
// status. Keep it short.
const MANIFEST = [
  // The only exit from trust: artist (paid) or buyer (refunded), nothing else.
  // The only hold status write, guarded by HOLD_TRANSITIONS; releaseTrust is its only caller.
  "lib/escrow/engine.ts transition: hold.status = to;",
  // The only append to the journal, after the account rules pass.
  "lib/escrow/journal.ts apply: s.journal.push(e);",
  // A payout is recorded only for holds releaseTrust just released.
  "lib/escrow/engine.ts payOut: s.payouts.push({",
  // Money in: the gallery's part of a payment, the artist's part into a new hold.
  "lib/escrow/engine.ts receivePayment: gallery.operatingBalanceCents += amount - artistShare;",
  "lib/escrow/engine.ts receivePayment: s.holds.push(hold);",
  'lib/escrow/engine.ts receivePayment: sale.status = "paid";',
  'lib/escrow/engine.ts createSale: artwork.status = "sold";',
  // Failure: creditors take operating, never trust.
  "lib/escrow/engine.ts declareInsolvency: gallery.claimedByCreditorsCents =",
  "lib/escrow/engine.ts declareInsolvency: gallery.operatingBalanceCents = 0;",
  'lib/escrow/engine.ts declareInsolvency: gallery.status = "insolvent";',
  // Unsold consigned works go back to their artists.
  'lib/escrow/engine.ts declareInsolvency: for (const w of works) w.status = "returned";',
  // Cancel: the gallery refunds its own part from operating.
  "lib/escrow/engine.ts cancelSale: gallery.operatingBalanceCents -= galleryPart + covered;",
  'lib/escrow/engine.ts cancelSale: sale.status = "cancelled";',
  // The refund record: what came back from trust and from operating.
  "lib/escrow/engine.ts cancelSale: s.refunds.push({",
  'lib/escrow/engine.ts cancelSale: artwork.status = "consigned";',
];

/** Lines that import or call the journal's posting functions, by file and function. */
function journalUses(): string[] {
  const out: string[] = [];
  for (const file of files(SRC)) {
    const rel = path.relative(SRC, file);
    if (rel === "lib/escrow/journal.ts") continue;
    let fn = "(top level)";
    const text = fs.readFileSync(file, "utf8");
    if (/from "(\.\/|@\/lib\/escrow\/)journal"/.test(text)) {
      const imported = text.match(
        /import \{([^}]*)\} from "(?:\.\/|@\/lib\/escrow\/)journal"/,
      );
      for (const name of (imported?.[1] ?? "")
        .split(",")
        .map((x) => x.trim())) {
        if (/^(post|postTrustRelease|openingJournal)$/.test(name)) {
          out.push(`${rel} imports ${name}`);
        }
      }
    }
    text.split("\n").forEach((line) => {
      const m = line.match(/^(?:export )?(?:async )?function (\w+)/);
      if (m) fn = m[1];
      if (/\bpostTrustRelease\(/.test(line))
        out.push(`${rel} ${fn} calls postTrustRelease`);
    });
  }
  return out.sort();
}

describe("architecture: only the engine posts to the journal", () => {
  it("post and postTrustRelease are imported by engine.ts only, openingJournal by seed.ts only", () => {
    expect(journalUses()).toEqual(
      [
        "lib/escrow/engine.ts imports post",
        "lib/escrow/engine.ts imports postTrustRelease",
        "lib/escrow/engine.ts releaseTrust calls postTrustRelease",
        "lib/seed.ts imports openingJournal",
      ].sort(),
    );
  });
});

describe("architecture: every write that moves money is accounted for", () => {
  it("matches the reviewed manifest exactly", () => {
    expect(writes()).toEqual([...MANIFEST].sort());
  });

  it("no page, component or route writes money directly", () => {
    const outsideLib = writes().filter((w) => !w.startsWith("lib/"));
    expect(outsideLib).toEqual([]);
  });

  it("hold status changes happen in transition() and nowhere else", () => {
    const holdStatus = writes().filter((w) =>
      /live\.status|hold\.status|\bh\.status/.test(w),
    );
    expect(holdStatus.every((w) => w.includes(" transition: "))).toBe(true);
    expect(holdStatus).toHaveLength(1);
  });
});

describe("architecture: routes run on the demo clock", () => {
  const MUTATORS =
    /\b(createSale|receivePayment|cancelSale|declareInsolvency|attemptTrustMove|releaseDueHolds|applyTerms|closePeriod)\(/;

  it("every engine call in a route passes clockFor(...)", () => {
    const bad: string[] = [];
    for (const file of files(path.join(SRC, "app/api"))) {
      const text = fs.readFileSync(file, "utf8");
      // Join each call to its closing paren so multi-line calls are seen whole.
      const calls = text.match(
        /\b(?:createSale|receivePayment|cancelSale|declareInsolvency|attemptTrustMove|releaseDueHolds|applyTerms|closePeriod)\([\s\S]*?\)\s*[,;.)]/g,
      );
      for (const c of calls ?? []) {
        if (MUTATORS.test(c) && !c.includes("clockFor(")) {
          bad.push(`${path.relative(SRC, file)}: ${c.split("\n")[0]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("outside tests, createSeed() is always given the time", () => {
    const bad: string[] = [];
    for (const file of files(SRC)) {
      const rel = path.relative(SRC, file);
      if (rel === "lib/seed.ts") continue;
      if (/\bcreateSeed\(\)/.test(fs.readFileSync(file, "utf8"))) bad.push(rel);
    }
    expect(bad).toEqual([]);
  });
});

describe("architecture: transition() is called from releaseTrust only", () => {
  it("has exactly one caller", () => {
    const callers: string[] = [];
    for (const file of files(SRC)) {
      let fn = "(top level)";
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line) => {
          const m = line.match(/^(?:export )?(?:async )?function (\w+)/);
          if (m) fn = m[1];
          if (
            // A call passes arguments; "transition()" in prose or a test
            // title is not a call.
            /\btransition\((?!\))/.test(line) &&
            !/function transition/.test(line)
          ) {
            callers.push(`${path.relative(SRC, file)} ${fn}`);
          }
        });
    }
    expect(callers).toEqual(["lib/escrow/engine.ts releaseTrust"]);
  });
});

describe("architecture: the plants never reach real books", () => {
  it("only the /lab component imports plants.ts", () => {
    const importers = files(SRC)
      .filter((f) =>
        /from "(\.\/|@\/lib\/escrow\/)plants"/.test(fs.readFileSync(f, "utf8")),
      )
      .map((f) => path.relative(SRC, f));
    expect(importers).toEqual(["components/BreakTheBooks.tsx"]);
  });
});
