import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "@/types";
import { createSeed, SEED_VERSION } from "@/lib/seed";

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
    // Files from an older seed are reseeded rather than loaded.
    record.seedVersion === SEED_VERSION &&
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
  const seed = createSeed(new Date().toISOString());
  save(seed);
  return seed;
}

// Every change runs one at a time against the latest saved state, so two
// requests can never overwrite each other's work.
let queue: Promise<unknown> = Promise.resolve();

export function mutate<T>(
  change: (current: Snapshot) => { snapshot: Snapshot; result: T },
  { undoable = true }: { undoable?: boolean } = {},
): Promise<{ snapshot: Snapshot; result: T }> {
  return enqueue(() => {
    const before = load();
    const out = change(structuredClone(before));
    if (undoable && JSON.stringify(out.snapshot) !== JSON.stringify(before)) {
      pushHistory(before);
    }
    save(out.snapshot);
    return out;
  });
}

function enqueue<T>(work: () => T): Promise<T> {
  const run = queue.then(work);
  // Keep the queue moving even when a change throws; the caller still sees the error.
  queue = run.catch(() => undefined);
  return run;
}

// Undo for the presenter: the states before the last few changes, newest last.
// Demo only; it restores whole snapshots, it never moves money itself.
const HISTORY_LIMIT = 30;
function historyPath(): string {
  return path.join(dataDir(), "history.json");
}

function readHistory(): Snapshot[] {
  const file = historyPath();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(parsed) && parsed.every(isSnapshot)) return parsed;
    console.error(`[store] ${file} has the wrong shape; clearing undo history`);
  } catch (err) {
    console.error(`[store] could not read ${file}; clearing undo history`, err);
  }
  return [];
}

function writeHistory(history: Snapshot[]): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  const file = historyPath();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(history.slice(-HISTORY_LIMIT)));
  fs.renameSync(tmp, file);
}

function pushHistory(snapshot: Snapshot): void {
  writeHistory([...readHistory(), snapshot]);
}

/** Forgets every earlier state, so undo can't step back past a reset. */
export function clearHistory(): Promise<void> {
  return enqueue(() => writeHistory([]));
}

/** Restores the state before the last change. Null when there is nothing to undo. */
export function undo(): Promise<Snapshot | null> {
  return enqueue(() => {
    const history = readHistory();
    const previous = history.pop();
    if (!previous) return null;
    writeHistory(history);
    save(previous);
    return previous;
  });
}
