"use client";

import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/types";

const POLL_MS = 1500;

/** Live view of the demo state, plus a helper to call the demo routes. */
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`State request failed (${res.status})`);
      setSnapshot((await res.json()) as Snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    // Initial load and polling: the state lives on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const act = useCallback(
    async (path: string, body?: unknown): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = (await res.json()) as Snapshot | { error: string };
        if (!res.ok || "error" in data) {
          setError(
            "error" in data ? data.error : `Request failed (${res.status})`,
          );
          return false;
        }
        setSnapshot(data);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { snapshot, error, busy, act, clearError: () => setError(null) };
}
