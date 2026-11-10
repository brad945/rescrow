// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as readAgreement } from "./agent/read/route";
import { POST as cancel } from "./demo/cancel/route";
import { POST as insolvency } from "./demo/insolvency/route";
import { POST as pay } from "./demo/payment/route";
import { POST as reset } from "./demo/reset/route";
import { POST as sell } from "./demo/sale/route";
import { GET as state } from "./state/route";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rescrow-api-"));
  process.env.RESCROW_DATA_DIR = dir;
  // Route tests cover the HTTP layer; the live model has its own tests.
  process.env.RESCROW_AGENT = "fixture";
});
afterEach(() => {
  delete process.env.RESCROW_DATA_DIR;
  delete process.env.RESCROW_AGENT;
  fs.rmSync(dir, { recursive: true, force: true });
});

function post(body: unknown) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("demo API", () => {
  it("runs a full sale: close, pay twice, artist paid", async () => {
    let res = await sell(
      post({ artworkId: "wrk_salt", buyerName: "J. Park", installments: 2 }),
    );
    expect(res.status).toBe(200);
    const saleId = (await res.json()).sales.at(-1).id;

    await pay(post({ saleId }));
    res = await pay(post({ saleId, method: "ach" }));
    const s = await res.json();
    expect(s.sales.find((x: { id: string }) => x.id === saleId).status).toBe(
      "paid",
    );
    expect(s.payouts.at(-1).amountCents).toBe(475_000);
  });

  it("rejects bad JSON, wrong types, and unknown ids with a 400 and a message", async () => {
    for (const res of [
      await sell(post("{not json")),
      await sell(
        post({ artworkId: "wrk_salt", buyerName: "x", installments: 0 }),
      ),
      await sell(
        post({
          artworkId: "wrk_salt",
          buyerName: "x".repeat(81),
          installments: 1,
        }),
      ),
      await pay(post({ saleId: "sale_missing" })),
      await pay(post({ saleId: "sale_lamps", amountCents: -5 })),
      await cancel(post({ saleId: "sale_tidewater" })),
      await readAgreement(post({ agreementId: "agr_missing" })),
    ]) {
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
    }
  });

  it("refuses to sell a work twice", async () => {
    const body = { artworkId: "wrk_harbor", buyerName: "A", installments: 1 };
    expect((await sell(post(body))).status).toBe(200);
    const res = await sell(post(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not available/);
  });

  it("reads an agreement and then allows that artist's work to sell", async () => {
    const before = await sell(
      post({ artworkId: "wrk_orchard", buyerName: "A", installments: 1 }),
    );
    expect(before.status).toBe(400);
    expect(
      (await readAgreement(post({ agreementId: "agr_ines" }))).status,
    ).toBe(200);
    const after = await sell(
      post({ artworkId: "wrk_orchard", buyerName: "A", installments: 1 }),
    );
    expect(after.status).toBe(200);
  });

  it("reset restores the seed", async () => {
    await sell(
      post({ artworkId: "wrk_salt", buyerName: "A", installments: 1 }),
    );
    await reset();
    const s = await (await state()).json();
    expect(s.sales).toHaveLength(2);
    expect(
      s.artworks.find((w: { id: string }) => w.id === "wrk_salt").status,
    ).toBe("consigned");
  });

  it("runs the insolvency beat: creditors take operating, artists are paid from trust", async () => {
    await readAgreement(post({ agreementId: "agr_ines" }));
    let res = await sell(
      post({
        artworkId: "wrk_orchard",
        buyerName: "M. Ybarra",
        installments: 3,
      }),
    );
    const saleId = (await res.json()).sales.at(-1).id;
    await pay(post({ saleId }));
    await pay(post({ saleId, method: "ach" }));

    res = await insolvency(post({ galleryId: "gal_lowline" }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.galleries[0].status).toBe("insolvent");
    expect(s.galleries[0].operatingBalanceCents).toBe(0);
    expect(
      s.holds.filter((h: { status: string }) => h.status === "locked"),
    ).toEqual([]);
    const ines = s.payouts.filter(
      (p: { artistId: string }) => p.artistId === "art_ines",
    );
    expect(ines.at(-1).amountCents).toBe(800_000);

    res = await pay(post({ saleId }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/insolvent/);

    res = await reset();
    expect((await res.json()).galleries[0].status).toBeUndefined();
  });

  it("rejects an insolvency request with no gallery id", async () => {
    const res = await insolvency(post({}));
    expect(res.status).toBe(400);
  });
});
