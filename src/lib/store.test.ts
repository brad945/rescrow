// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSale, receivePayment } from "@/lib/escrow/engine";
import { load, mutate, reset, save } from "./store";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rescrow-store-"));
  process.env.RESCROW_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.RESCROW_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const db = () => path.join(dir, "db.json");

describe("store", () => {
  it("creates the seed on first load", () => {
    const s = load();
    expect(s.galleries[0].name).toBe("Lowline Gallery");
    expect(fs.existsSync(db())).toBe(true);
  });

  it("reseeds and logs when the file is corrupt", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fs.writeFileSync(db(), '{"galleries": [');
    expect(load().galleries).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    expect(() => JSON.parse(fs.readFileSync(db(), "utf8"))).not.toThrow();
  });

  it("reseeds when the file has the wrong shape", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fs.writeFileSync(db(), "{}");
    expect(load().artworks.length).toBeGreaterThan(0);
  });

  it("leaves no temp files behind after saving", () => {
    save(reset());
    expect(fs.readdirSync(dir)).toEqual(["db.json"]);
  });

  it("applies simultaneous changes one after another without losing any", async () => {
    reset();
    const { snapshot } = await mutate((s) => {
      const out = createSale(s, {
        artworkId: "wrk_salt",
        buyerName: "J. Park",
        installments: 3,
      });
      return { snapshot: out.snapshot, result: out.sale };
    });
    const saleId = snapshot.sales.at(-1)!.id;

    await Promise.all(
      [0, 1, 2].map(() =>
        mutate((s) => {
          const out = receivePayment(s, { saleId });
          return { snapshot: out.snapshot, result: out.hold };
        }),
      ),
    );

    const final = load();
    expect(final.payments.filter((p) => p.saleId === saleId)).toHaveLength(3);
    expect(final.sales.find((x) => x.id === saleId)?.status).toBe("paid");
  });

  it("keeps working after a change throws", async () => {
    reset();
    await expect(
      mutate(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const { result } = await mutate((s) => ({ snapshot: s, result: "ok" }));
    expect(result).toBe("ok");
  });
});
