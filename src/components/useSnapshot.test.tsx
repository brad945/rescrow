import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "@/lib/seed";
import type { Snapshot } from "@/types";
import { useSnapshot } from "./useSnapshot";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function labelled(name: string): Snapshot {
  const s = createSeed();
  s.galleries[0].name = name;
  return s;
}

afterEach(() => vi.unstubAllGlobals());

describe("useSnapshot", () => {
  it("drops a poll response that started before an action finished", async () => {
    let releaseStalePoll: (r: Response) => void = () => {};
    let polls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/state") {
          polls += 1;
          if (polls === 1) return Promise.resolve(json(labelled("first")));
          // The second poll hangs until we release it, after the action.
          return new Promise<Response>((r) => (releaseStalePoll = r));
        }
        return Promise.resolve(json(labelled("after action")));
      }),
    );

    const { result } = renderHook(() => useSnapshot());
    await waitFor(() =>
      expect(result.current.snapshot?.galleries[0].name).toBe("first"),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 1600)); // second poll starts and hangs
      await result.current.act("/api/demo/reset");
    });
    expect(result.current.snapshot?.galleries[0].name).toBe("after action");

    await act(async () => {
      releaseStalePoll(json(labelled("stale")));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.snapshot?.galleries[0].name).toBe("after action");
  });

  it("shows the server's error message when an action is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url === "/api/state"
            ? json(createSeed())
            : json({ error: "Sale sale_x not found" }, 400),
        ),
      ),
    );
    const { result } = renderHook(() => useSnapshot());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    let ok = true;
    await act(async () => {
      ok = await result.current.act("/api/demo/payment", { saleId: "sale_x" });
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe("Sale sale_x not found");
  });

  it("clears a connection error once polling recovers", async () => {
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        fail
          ? Promise.reject(new Error("offline"))
          : Promise.resolve(json(createSeed())),
      ),
    );
    const { result } = renderHook(() => useSnapshot());
    await waitFor(() => expect(result.current.error).toMatch(/offline/));
    fail = false;
    await waitFor(() => expect(result.current.error).toBeNull(), {
      timeout: 3000,
    });
  });
});
