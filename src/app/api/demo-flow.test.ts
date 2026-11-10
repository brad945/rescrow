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
import { POST as readAgreement } from "./agent/read/route";
import { POST as attempt } from "./demo/attempt/route";
import { POST as cancel } from "./demo/cancel/route";
import { POST as insolvency } from "./demo/insolvency/route";
import { POST as pay } from "./demo/payment/route";
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
    s = await call("/api/demo/insolvency", { galleryId: "gal_lowline" });

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

  it("buyer cancels after payment one: refunded from trust, books balance", async () => {
    let { s } = await press(await call("/api/demo/reset"), 3);
    expect(stepFor(s).canCancel).toBe(true);
    const sale = s.sales.filter((x) => x.artworkId === "wrk_orchard").at(-1)!;
    s = await call("/api/demo/cancel", { saleId: sale.id });
    expect(stepFor(s).index).toBe(6);
    balanced(s);
  });

  it("polling /api/state mid-demo never changes the story", async () => {
    const { s } = await press(await call("/api/demo/reset"), 3);
    const polled = (await (await state()).json()) as Snapshot;
    expect(stepFor(polled).title).toBe(stepFor(s).title);
  });
});
