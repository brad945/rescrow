// Mapping Rescrow's books onto the gallery's own chart of accounts, for export.
//
// A gallery's bookkeeper has their own chart, not Rescrow's 1010-5010 codes.
// Most mappings are a matter of taste, but some would commingle trust money
// on paper even though the bank never did: restricted trust cash booked to
// the operating bank account, or what is owed to artists booked as income.
// validateMapping refuses those, all or nothing, with every reason.
import { CHART } from "@/lib/books";

export type GalleryAccountType =
  "Bank" | "Other Current Liability" | "Equity" | "Income" | "Expense";

export interface GalleryAccount {
  number: string;
  name: string;
  type: GalleryAccountType;
  /** For liabilities: who the money is owed to, if anyone in particular. */
  owedTo?: "artists" | "buyers";
}

/** A small gallery's chart, shaped like a typical small-business chart. A fixture. */
export const GALLERY_CHART: GalleryAccount[] = [
  { number: "1000", name: "Ramp Checking ··4417 (operating)", type: "Bank" },
  { number: "1005", name: "Ramp Checking ··4425 (artist trust)", type: "Bank" },
  {
    number: "2100",
    name: "Due to consignors",
    type: "Other Current Liability",
    owedTo: "artists",
  },
  {
    number: "2200",
    name: "Customer deposits",
    type: "Other Current Liability",
    owedTo: "buyers",
  },
  {
    number: "2300",
    name: "Sales tax payable",
    type: "Other Current Liability",
  },
  { number: "3000", name: "Owner's equity", type: "Equity" },
  { number: "3200", name: "Retained earnings", type: "Equity" },
  { number: "4000", name: "Commission income", type: "Income" },
  { number: "4100", name: "Art sales", type: "Income" },
  { number: "6100", name: "Refunds and allowances", type: "Expense" },
];

/** Rescrow account code -> gallery account number. */
export type ChartMapping = Record<string, string>;

/** A mapping a careful bookkeeper would choose. It validates. */
export const SUGGESTED_MAPPING: ChartMapping = {
  "1010": "1000",
  "1020": "1005",
  "2010": "2100",
  "2020": "2200",
  "3000": "3000",
  "3900": "3000",
  "4010": "4000",
  "5010": "6100",
};

/** Every reason this mapping can't be used; empty if it can. */
export function validateMapping(
  mapping: ChartMapping,
  chart: GalleryAccount[] = GALLERY_CHART,
): string[] {
  const out: string[] = [];
  const target = (code: string) =>
    chart.find((a) => a.number === mapping[code]);
  for (const code of Object.keys(CHART)) {
    if (!mapping[code]) {
      out.push(`${code} ${CHART[code].name} isn't mapped`);
    } else if (!target(code)) {
      out.push(
        `${code} is mapped to ${mapping[code]}, which isn't in the gallery's chart`,
      );
    }
  }
  const trust = target("1020");
  if (trust && trust.type !== "Bank") {
    out.push(
      `Restricted trust cash (1020) must map to a bank account, not ${trust.type}`,
    );
  }
  if (mapping["1020"] && mapping["1020"] === mapping["1010"]) {
    out.push(
      "Trust cash (1020) and operating cash (1010) can't share an account: that is commingling on paper",
    );
  }
  for (const [code, owedTo] of [
    ["2010", "artists"],
    ["2020", "buyers"],
  ] as const) {
    const t = target(code);
    if (!t) continue;
    if (t.type !== "Other Current Liability") {
      out.push(
        `${code} ${CHART[code].name} is owed to ${owedTo}: it must map to a liability, not ${t.type}`,
      );
    } else if (t.owedTo !== owedTo) {
      out.push(
        `${code} ${CHART[code].name} must map to a liability owed to ${owedTo}, not ${t.name}`,
      );
    }
  }
  // Nothing else may land in the trust bank account or the artists' liability.
  for (const [guarded, label] of [
    ["1020", "the trust bank account"],
    ["2010", "what is owed to artists"],
  ] as const) {
    const shared = Object.keys(CHART).filter(
      (c) => c !== guarded && mapping[c] && mapping[c] === mapping[guarded],
    );
    if (shared.length > 0) {
      out.push(
        `${shared.join(", ")} can't share an account with ${label} (${guarded})`,
      );
    }
  }
  return out;
}

/** Account number and name for a Rescrow code under a validated mapping. */
export function mapAccount(
  code: string,
  mapping: ChartMapping | null,
  chart: GalleryAccount[] = GALLERY_CHART,
): { number: string; name: string } {
  if (!mapping) return { number: code, name: CHART[code].name };
  const a = chart.find((x) => x.number === mapping[code]);
  return a
    ? { number: a.number, name: a.name }
    : { number: code, name: CHART[code].name };
}
