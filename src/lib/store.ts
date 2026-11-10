import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "@/types";
import { createSeed } from "@/lib/seed";

// Demo persistence: one JSON file, rewritten on every change.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

export function load(): Snapshot {
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeed();
    save(seed);
    return seed;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Snapshot;
}

export function save(snapshot: Snapshot): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(snapshot, null, 2));
}

export function reset(): Snapshot {
  const seed = createSeed();
  save(seed);
  return seed;
}
