"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/types";

const POLL_MS = 1500;

/** Live view of the demo state, plus a helper to call the demo routes. */
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped whenever an action starts or finishes. A poll that began before
  // that point would carry older state, so its result is dropped.
  const generation = useRef(0);
  const acting = useRef(false);

  const refresh = useCallback(async () => {
    if (acting.current) return;
    const startedAt = generation.current;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`State request failed (${res.status})`);
      const data = (await res.json()) as Snapshot;
      if (startedAt !== generation.current || acting.current) return;
      setSnapshot(data);
      setPollError(null);
    } catch (err) {
      setPollError(
        err instanceof Error
          ? `Lost connection to the server: ${err.message}`
          : String(err),
      );
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
      if (acting.current) return false;
      acting.current = true;
      generation.current += 1;
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = (await res.json()) as Snapshot | { error: string };
        if (!res.ok || "error" in data) {
          setActionError(
            "error" in data ? data.error : `Request failed (${res.status})`,
          );
          return false;
        }
        setSnapshot(data);
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        generation.current += 1;
        acting.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return {
    snapshot,
    error: actionError ?? pollError,
    busy,
    act,
    clearError: () => setActionError(null),
  };
}
