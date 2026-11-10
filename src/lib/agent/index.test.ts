// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "@/lib/seed";
import { readAgreement } from "./index";

const ines = createSeed().agreements.find((a) => a.id === "agr_ines")!;

/** Fakes Ollama's streaming reply, split into a few chunks. */
function ollamaReply(content: string) {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += 25)
    chunks.push(content.slice(i, i + 25));
  const body = chunks
    .map((c) => JSON.stringify({ message: { content: c } }) + "\n")
    .join("");
  return new Response(body, { status: 200 });
}

const answer = JSON.stringify({
  artistSharePercent: 50,
  shareQuote: "the Gallery keeps half and the Artist keeps half",
  payoutDays: 60,
  payoutQuote: "no later than sixty (60) days following receipt by the Gallery",
  notes: [],
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("readAgreement", () => {
  it("streams the model's reply and returns verified terms", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ollamaReply(answer)),
    );
    const tokens: string[] = [];
    const result = await readAgreement(ines, {
      onToken: (t) => tokens.push(t),
    });
    expect(result.source).toBe("model");
    expect(result.verified).toBe(true);
    expect(result.terms.artistShareBps).toBe(5000);
    expect(tokens.join("")).toBe(answer);
  });

  it("marks a reply it cannot back with quotes as unverified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ollamaReply(
          answer.replace('"artistSharePercent":50', '"artistSharePercent":80'),
        ),
      ),
    );
    const result = await readAgreement(ines);
    expect(result.source).toBe("model");
    expect(result.verified).toBe(false);
  });

  it("falls back to the cached answer and logs why when Ollama is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );
    const result = await readAgreement(ines);
    expect(result.source).toBe("fixture");
    expect(result.fallbackReason).toMatch(/ECONNREFUSED/);
    expect(error).toHaveBeenCalled();
  });

  it("falls back when the model returns broken JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ollamaReply("{not json")),
    );
    const result = await readAgreement(ines);
    expect(result.source).toBe("fixture");
  });

  it("skips the model entirely when RESCROW_AGENT=fixture", async () => {
    vi.stubEnv("RESCROW_AGENT", "fixture");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await readAgreement(ines);
    expect(result.source).toBe("fixture");
    expect(fetch).not.toHaveBeenCalled();
  });
});
