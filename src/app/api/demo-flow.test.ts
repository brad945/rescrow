// @vitest-environment node
//
// The recorded demo, driven through the real route handlers exactly the way
// /present drives them: each step's `next` button is followed until the story
// ends. Any change that breaks the script on stage breaks this test first.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Snapshot } from "@/types";
import { stepFor } from "@/components/story";
import { reconcile } from "@/lib/escrow/reconcile";
import { insolvencyOutcome } from "@/lib/insolvency";
import { POST as readAgreement } from "./agent/read/route";
import { POST as advance } from "./demo/advance/route";
import { POST as attempt } from "./demo/attempt/route";
import { POST as cancel } from "./demo/cancel/route";
import { POST as insolvency } from "./demo/insolvency/route";
import { POST as pay } from "./demo/payment/route";
import { POST as redeliver } from "./demo/redeliver/route";
import { POST as reset } from "./demo/reset/route";
import { POST as sell } from "./demo/sale/route";
import { GET as state } from "./state/route";

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "/api/agent/read": readAgreement,
  "/api/demo/sale": sell,
  "/api/demo/payment": pay,
  "/api/demo/cancel": cancel,
  "/api/demo/insolvency": insolvency,
  "/api/demo/reset": reset,
  "/api/demo/attempt": attempt,
  "/api/demo/advance": advance,
  "/api/demo/redeliver": redeliver,
};

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rescrow-flow-"));
  process.env.RESCROW_DATA_DIR = dir;
});
afterEach(() => {
  delete process.env.RESCROW_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function call(p: string, body: unknown = {}): Promise<Snapshot> {
  const handler = ROUTES[p];
  if (!handler) throw new Error(`/present calls ${p}, which has no route`);
  const res = await handler(
    new Request(`http://test${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const json = await res.json();
  if (res.status !== 200) throw new Error(`${p} → ${res.status} ${json.error}`);
  return json as Snapshot;
}

/** Press → `n` times (or until the story has no next step). */
async function press(s: Snapshot, n = Infinity) {
  const titles = [stepFor(s).title];
  for (let i = 0; i < n; i++) {
    const step = stepFor(s);
    if (!step.next) break;
    s = await call(step.next.path, step.next.body);
    titles.push(stepFor(s).title);
  }
  return { s, titles };
}

function balanced(s: Snapshot) {
  const r = reconcile(s, "gal_lowline");
  expect(r.breaks).toEqual([]);
  expect(r.balanced).toBe(true);
}

describe("the recorded demo, end to end", () => {
  it("happy path: agreement read, three payments, Ines paid the same day", async () => {
    const start = await call("/api/demo/reset");
    expect(stepFor(start).index).toBe(0);

    const { s, titles } = await press(start);
    expect(titles.length).toBeGreaterThanOrEqual(6);
    const sale = s.sales.filter((x) => x.artworkId === "wrk_orchard").at(-1)!;
    expect(sale.status).toBe("paid");
    const ines = s.payouts.filter((p) => p.artistId === "art_ines");
    expect(ines.reduce((a, p) => a + p.amountCents, 0)).toBe(1_200_000);
    balanced(s);
  });

  it("every intermediate step keeps the books balanced", async () => {
    let s = await call("/api/demo/reset");
    balanced(s);
    for (;;) {
      const step = stepFor(s);
      if (!step.next) break;
      s = await call(step.next.path, step.next.body);
      balanced(s);
    }
  });

  it("gallery goes under after payment two: the narrated numbers", async () => {
    // R, → four times (read, sell, pay, pay), then B.
    let { s } = await press(await call("/api/demo/reset"), 4);
    expect(stepFor(s).canFail).toBe(true);
    const before = reconcile(s, "gal_lowline");
    s = await call("/api/demo/insolvency", { galleryId: "gal_lowline" });
    // The counterfactual on screen: operating plus trust just before B.
    expect(insolvencyOutcome(s, "gal_lowline")!.commingledCents).toBe(
      before.operatingCents + before.trustCents,
    );

    const g = s.galleries.find((x) => x.id === "gal_lowline")!;
    expect(g.status).toBe("insolvent");
    expect(g.operatingBalanceCents).toBe(0);
    expect(g.claimedByCreditorsCents).toBe(4_983_627); // "$49,836.27"
    const paid = (artist: string) =>
      s.payouts
        .filter((p) => p.artistId === artist)
        .reduce((a, p) => a + p.amountCents, 0);
    expect(paid("art_ines")).toBe(800_000); // "$8,000"
    expect(paid("art_theo")).toBe(240_000); // "$2,400"
    expect(stepFor(s).index).toBe(7);
    balanced(s);

    // Unsold consigned works go back to their artists, not into the estate.
    const left = s.artworks.filter((w) => w.status === "consigned");
    expect(left).toEqual([]);
    expect(s.artworks.some((w) => w.status === "returned")).toBe(true);
    expect(s.activity.some((a) => a.kind === "artwork_returned")).toBe(true);

    // Nothing more can be sold or paid, and reset restores the stage.
    await expect(
      call("/api/demo/sale", {
        artworkId: "wrk_harbor",
        buyerName: "Late",
        installments: 1,
      }),
    ).rejects.toThrow(/insolvent/);
    s = await call("/api/demo/reset");
    expect(stepFor(s).index).toBe(0);
  });

  it("G then B: the refused spend changes nothing, the ending is the same", async () => {
    let { s } = await press(await call("/api/demo/reset"), 4);
    const step = stepFor(s);
    expect(step.attempt).toBeDefined();
    const before = s;
    s = await call(step.attempt!.path, step.attempt!.body);
    expect(s.galleries).toEqual(before.galleries);
    expect(s.holds).toEqual(before.holds);
    expect(s.activity[0].kind).toBe("trust_move_refused");
    expect(s.activity[0].artistId).toBe("art_ines");
    expect(s.activity[0].amountCents).toBe(800_000);
    balanced(s);

    s = await call("/api/demo/insolvency", { galleryId: "gal_lowline" });
    expect(s.galleries[0].claimedByCreditorsCents).toBe(4_983_627);
    const ines = s.payouts
      .filter((p) => p.artistId === "art_ines")
      .reduce((a, p) => a + p.amountCents, 0);
    expect(ines).toBe(800_000);
    balanced(s);
  });

  it("G before any payment is a 400, not a crash", async () => {
    const { s } = await press(await call("/api/demo/reset"), 2);
    const sale = s.sales.at(-1)!;
    await expect(
      call("/api/demo/attempt", { saleId: sale.id, kind: "rent" }),
    ).rejects.toThrow(/400 Nothing in trust/);
  });

  it("T after payment one: Ines is paid on her deadline, then in full", async () => {
    let { s } = await press(await call("/api/demo/reset"), 3);
    expect(stepFor(s).advance).toBeDefined();
    s = await call(stepFor(s).advance!.path, stepFor(s).advance!.body);
    const step = stepFor(s);
    expect(step.title).toMatch(/^Day \+61: Ines paid on her deadline/);
    expect(step.canFail).toBe(false); // the $8,000 insolvency take needs day 0
    expect(step.advance).toBeUndefined(); // one jump only
    const inesPaid = () =>
      s.payouts
        .filter((p) => p.artistId === "art_ines")
        .reduce((a, p) => a + p.amountCents, 0);
    expect(inesPaid()).toBe(400_000);
    expect(s.payouts.find((p) => p.artistId === "art_ines")!.reason).toBe(
      "deadline",
    );
    // Each deadline payout is stamped at its own deadline, not at the jump.
    for (const p of s.payouts.filter((x) => x.reason === "deadline")) {
      const holds = s.holds.filter((h) => p.holdIds.includes(h.id));
      for (const h of holds) expect(p.paidAt).toBe(h.dueBy);
    }
    // Theo's 14-day seeded share falls due inside the jump as well.
    expect(
      s.payouts.some(
        (p) => p.artistId === "art_theo" && p.reason === "deadline",
      ),
    ).toBe(true);
    balanced(s);

    ({ s } = await press(s));
    expect(s.sales.find((x) => x.artworkId === "wrk_orchard")!.status).toBe(
      "paid",
    );
    expect(inesPaid()).toBe(1_200_000);
    expect(stepFor(s).caption).toMatch(
      /already been paid \$4,000\.00 on her deadline/,
    );
    balanced(s);

    // Payouts are stamped on the demo clock, in order.
    const stamps = s.payouts.slice(1).map((p) => p.paidAt);
    expect([...stamps].sort()).toEqual(stamps);

    // Reset puts the clock back.
    s = await call("/api/demo/reset");
    expect(s.clockOffsetMs).toBe(0);
    expect(stepFor(s).index).toBe(0);
  });

  it("cancel after T: the buyer gets all $8,000 back, Ines keeps her $4,000", async () => {
    let { s } = await press(await call("/api/demo/reset"), 3);
    s = await call("/api/demo/advance", { days: 61 });
    const sale = s.sales.filter((x) => x.artworkId === "wrk_orchard").at(-1)!;
    s = await call("/api/demo/cancel", { saleId: sale.id });
    const r = s.refunds.at(-1)!;
    expect(
      r.fromTrustCents + r.fromOperatingCents + r.coveredByGalleryCents,
    ).toBe(800_000);
    expect(r.coveredByGalleryCents).toBe(400_000);
    // The caption must say what actually happened: not "refunded from trust".
    const caption = stepFor(s).caption;
    expect(caption).toMatch(/got every cent back/);
    expect(caption).toMatch(/keeps the \$4,000\.00 she was already paid/);
    expect(caption).not.toMatch(/refunded to them straight from the trust/);
    balanced(s);
  });

  it("D after the final wire: a redelivered transaction books nothing", async () => {
    let { s } = await press(await call("/api/demo/reset"));
    const step = stepFor(s);
    expect(step.redeliver).toBeDefined();
    const before = s;
    s = await call(step.redeliver!.path, step.redeliver!.body);
    for (const k of [
      "galleries",
      "payments",
      "holds",
      "payouts",
      "journal",
    ] as const) {
      expect(s[k]).toEqual(before[k]);
    }
    expect(s.activity[0].kind).toBe("feed_duplicate");
    expect(s.activity[0].artistId).toBe("art_ines");
    const ines = s.payouts
      .filter((p) => p.artistId === "art_ines")
      .reduce((a, p) => a + p.amountCents, 0);
    expect(ines).toBe(1_200_000);
    balanced(s);
  });

  it("pressing → twice for the same wire can't book it twice", async () => {
    const { s } = await press(await call("/api/demo/reset"), 3);
    const sale = s.sales.at(-1)!;
    const first = s.payments.filter((p) => p.saleId === sale.id)[0];
    const again = await call("/api/demo/payment", {
      saleId: sale.id,
      method: first.method,
      rampTransactionId: first.rampTransactionId,
    });
    expect(again.payments).toEqual(s.payments);
    balanced(again);
  });

  it("the demo clock refuses silly jumps", async () => {
    await call("/api/demo/reset");
    for (const days of [0, -3, 1.5, 121]) {
      await expect(call("/api/demo/advance", { days })).rejects.toThrow(/400/);
    }
  });

  it("buyer cancels after payment one: refunded from trust, books balance", async () => {
    let { s } = await press(await call("/api/demo/reset"), 3);
    expect(stepFor(s).canCancel).toBe(true);
    const sale = s.sales.filter((x) => x.artworkId === "wrk_orchard").at(-1)!;
    s = await call("/api/demo/cancel", { saleId: sale.id });
    expect(stepFor(s).index).toBe(6);
    const r = s.refunds.at(-1)!;
    expect(
      r.fromTrustCents + r.fromOperatingCents + r.coveredByGalleryCents,
    ).toBe(
      s.payments
        .filter((p) => p.saleId === sale.id)
        .reduce((a, p) => a + p.amountCents, 0),
    );
    expect(r.coveredByGalleryCents).toBe(0);
    balanced(s);
  });

  it("polling /api/state mid-demo never changes the story", async () => {
    const { s } = await press(await call("/api/demo/reset"), 3);
    const polled = (await (await state()).json()) as Snapshot;
    expect(stepFor(polled).title).toBe(stepFor(s).title);
  });
});
