import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "@/types";
import { createSeed } from "@/lib/seed";

// Demo persistence: one JSON file. Writes go to a temp file and are renamed
// into place, so a crash mid write never leaves a half written file.
// RESCROW_DATA_DIR lets tests point the store somewhere disposable.
function dataDir(): string {
  return process.env.RESCROW_DATA_DIR ?? path.join(process.cwd(), "data");
}
function dbPath(): string {
  return path.join(dataDir(), "db.json");
}

const KEYS: (keyof Snapshot)[] = [
  "galleries",
  "artists",
  "artworks",
  "agreements",
  "sales",
  "payments",
  "holds",
  "payouts",
  "activity",
  "journal",
  "refunds",
];

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    KEYS.every((k) => Array.isArray(record[k])) &&
    (record.galleries as unknown[]).length > 0 &&
    // Files saved before sales carried their own split are treated as stale.
    (record.sales as { artistShareBps?: unknown }[]).every(
      (sale) => typeof sale.artistShareBps === "number",
    )
  );
}

export function load(): Snapshot {
  const file = dbPath();
  if (!fs.existsSync(file)) return reset();
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (isSnapshot(parsed)) return parsed;
    console.error(`[store] ${file} has the wrong shape; reseeding`);
  } catch (err) {
    console.error(`[store] could not read ${file}; reseeding`, err);
  }
  return reset();
}

export function save(snapshot: Snapshot): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  const file = dbPath();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
  fs.renameSync(tmp, file);
}

export function reset(): Snapshot {
  const seed = createSeed();
  save(seed);
  return seed;
}

// Every change runs one at a time against the latest saved state, so two
// requests can never overwrite each other's work.
let queue: Promise<unknown> = Promise.resolve();

export function mutate<T>(
  change: (current: Snapshot) => { snapshot: Snapshot; result: T },
): Promise<{ snapshot: Snapshot; result: T }> {
  const run = queue.then(() => {
    const out = change(load());
    save(out.snapshot);
    return out;
  });
  // Keep the queue moving even when a change throws; the caller still sees the error.
  queue = run.catch(() => undefined);
  return run;
}
