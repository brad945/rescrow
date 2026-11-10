import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/seed";
import { glLines, toCsv, toQuickBooksJson, trialBalance } from "@/lib/books";
import {
  mapAccount,
  SUGGESTED_MAPPING,
  validateMapping,
  type ChartMapping,
} from "./chart";

const G = "gal_lowline";
const m = (patch: ChartMapping) => ({ ...SUGGESTED_MAPPING, ...patch });

describe("mapping the books onto the gallery's chart", () => {
  it("the suggested mapping validates", () => {
    expect(validateMapping(SUGGESTED_MAPPING)).toEqual([]);
  });

  it("two equity codes on one equity account are fine", () => {
    expect(validateMapping(m({ "3000": "3200", "3900": "3200" }))).toEqual([]);
  });

  const refusals: [string, ChartMapping, RegExp][] = [
    [
      "trust cash to a non-bank account",
      m({ "1020": "2300" }),
      /must map to the bank account titled as artist trust/,
    ],
    [
      "trust and operating cash in one account",
      m({ "1020": "1000" }),
      /commingling on paper/,
    ],
    [
      "trust and operating cash swapped",
      m({ "1010": "1005", "1020": "1000" }),
      /titled as artist trust/,
    ],
    [
      "operating cash booked as income",
      m({ "1010": "4000" }),
      /must map to an ordinary bank account/,
    ],
    [
      "commission booked into customer deposits",
      m({ "4010": "2200" }),
      /4010 .* must map to Income/,
    ],
    [
      "the administrator's take booked as income",
      m({ "3900": "4100" }),
      /3900 .* must map to Equity or Expense/,
    ],
    [
      "owed to artists booked as income",
      m({ "2010": "4000" }),
      /must map to a liability, not Income/,
    ],
    [
      "owed to artists on a liability for someone else",
      m({ "2010": "2300" }),
      /owed to artists, not Sales tax payable/,
    ],
    [
      "buyer deposits on the artists' liability",
      m({ "2020": "2100" }),
      /owed to buyers, not Due to consignors|share an account with what is owed to artists/,
    ],
    [
      "commission into the trust bank account",
      m({ "4010": "1005" }),
      /can't share an account with the trust bank account/,
    ],
    [
      "an account left unmapped",
      (() => {
        const x = { ...SUGGESTED_MAPPING };
        delete x["5010"];
        return x;
      })(),
      /5010 .* isn't mapped/,
    ],
    [
      "a number not in the chart",
      m({ "5010": "9999" }),
      /isn't in the gallery's chart/,
    ],
  ];
  for (const [name, mapping, why] of refusals) {
    it(`refuses ${name}`, () => {
      expect(validateMapping(mapping).join("\n")).toMatch(why);
    });
  }

  it("exports use the gallery's accounts, stay balanced and stable", () => {
    const s = createSeed();
    const lines = glLines(s, G);
    const namer = (code: string) => mapAccount(code, SUGGESTED_MAPPING);
    const csv = toCsv(s, lines, namer);
    expect(csv).toContain("1005,Ramp Checking ··4425 (artist trust)");
    expect(csv).not.toMatch(/^[^,]*,[^,]*,1020,/m);
    expect(toCsv(s, lines, namer)).toBe(csv);
    const qbo = JSON.parse(toQuickBooksJson(lines, namer)) as {
      JournalEntry: {
        Line: {
          Amount: string;
          JournalEntryLineDetail: {
            PostingType: string;
            AccountRef: { value: string };
          };
        }[];
      }[];
    };
    let dr = 0;
    let cr = 0;
    for (const e of qbo.JournalEntry) {
      for (const l of e.Line) {
        const cents = Math.round(Number(l.Amount) * 100);
        if (l.JournalEntryLineDetail.PostingType === "Debit") dr += cents;
        else cr += cents;
        expect([
          "1000",
          "1005",
          "2100",
          "2200",
          "3000",
          "4000",
          "6100",
        ]).toContain(l.JournalEntryLineDetail.AccountRef.value);
      }
    }
    expect(dr).toBe(cr);
    expect(dr).toBe(trialBalance(lines).debitCents);
  });
});
