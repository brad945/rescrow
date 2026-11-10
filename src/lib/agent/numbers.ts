// Pulls every number a contract clause states, whether written as digits
// ("60%", "(60)"), words ("sixty percent", "forty-five"), or fractions
// ("half", "two thirds"). Used to check the agent's numbers against its quotes.

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const FRACTIONS: [RegExp, number][] = [
  [/\bthree[\s-]quarters\b/, 75],
  [/\btwo[\s-]thirds\b/, 66.67],
  [/\b(?:one|a)[\s-]third\b/, 33.33],
  [/\b(?:one|a)[\s-]quarter\b/, 25],
  [/\b(?:one[\s-])?half\b/, 50],
  // Two-party contracts: "divided equally", "split evenly", "equal shares".
  [/\b(?:equally|evenly|equal (?:shares|parts))\b/, 50],
];

export function numbersIn(text: string): number[] {
  const lower = text.toLowerCase();
  const found = new Set<number>();

  for (const m of lower.matchAll(/\d+(?:\.\d+)?/g)) {
    found.add(Number(m[0]));
  }

  const words = lower.split(/[^a-z]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in TENS) {
      const next = words[i + 1];
      if (next && next in UNITS && UNITS[next] > 0 && UNITS[next] < 10) {
        found.add(TENS[w] + UNITS[next]);
        i++;
      } else {
        found.add(TENS[w]);
      }
    } else if (w in UNITS) {
      found.add(UNITS[w]);
    } else if (w === "hundred") {
      found.add(100);
    }
  }

  for (const [pattern, value] of FRACTIONS) {
    if (pattern.test(lower)) found.add(value);
  }

  return [...found];
}

/** True when the clause states this number (within a hundredth, for thirds). */
export function states(text: string, value: number): boolean {
  return numbersIn(text).some((n) => Math.abs(n - value) < 0.01);
}
