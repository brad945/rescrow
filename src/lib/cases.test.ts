// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CASES, LIMITS, type TestRef } from "./cases";

const ROOT = path.resolve(__dirname, "../..");

function exists(ref: TestRef): boolean {
  const file = path.join(ROOT, ref.file);
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, "utf8");
  return [`"${ref.title}"`, `'${ref.title}'`, `\`${ref.title}\``].some((q) =>
    text.includes(q),
  );
}

describe("why these rules", () => {
  it("every test the card names exists, with that exact title", () => {
    for (const row of [...CASES, ...LIMITS]) {
      if (row.test)
        expect(exists(row.test), `${row.test.file} › ${row.test.title}`).toBe(
          true,
        );
    }
  });

  it("every case has a source and a wording flag; out-of-scope cases name no test", () => {
    for (const c of CASES) {
      expect(c.source).toMatch(/^https:\/\//);
      expect(["reported", "alleged", "out_of_scope"]).toContain(c.status);
      if (c.status === "out_of_scope") expect(c.test).toBeNull();
      else expect(c.test).not.toBeNull();
    }
  });

  it("the limits say what isn't proven as plainly as what is", () => {
    expect(LIMITS.some((l) => !l.proves)).toBe(true);
    expect(LIMITS.some((l) => l.proves)).toBe(true);
  });
});
