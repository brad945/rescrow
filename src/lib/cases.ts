// Why these rules: the real failures behind them, and the test that enforces
// each. Wording follows the sources: "reported" for filings and charges,
// "alleged" for claims not decided, "out of scope" for what Rescrow doesn't
// address. Nothing here says what a court would rule.

export interface TestRef {
  file: string;
  title: string;
}

export interface CaseRow {
  name: string;
  year: number;
  status: "reported" | "alleged" | "out_of_scope";
  what: string;
  source: string;
  rule: string;
  test: TestRef | null;
}

export const CASES: CaseRow[] = [
  {
    name: "Stephen Friedman Gallery, London",
    year: 2026,
    status: "reported",
    what: "Administration owing artists over £800k; unsecured creditors expect 8 to 9p per pound (reported filings)",
    source:
      "https://www.theartnewspaper.com/2026/04/30/stephen-friedman-gallery-owes-£800000-to-artists-filings-reveal",
    rule: "At insolvency, creditors take operating cash; everything in trust is paid to the artists",
    test: {
      file: "src/lib/escrow/trust.test.ts",
      title:
        "sends operating cash to creditors and pays every artist out of trust",
    },
  },
  {
    name: "The Hole, New York",
    year: 2026,
    status: "alleged",
    what: "Artists allege unpaid proceeds were spent on rent, operating expenses and other creditors",
    source: "https://www.amny.com/law/artists-sue-the-hole-bowery-theft-pay/",
    rule: "Trust can't pay operating costs or creditors: the account rules refuse it before anything moves",
    test: {
      file: "src/lib/escrow/journal.test.ts",
      title: "trust to creditors",
    },
  },
  {
    name: "Cadence Comic Art",
    year: 2025,
    status: "alleged",
    what: "Artists alleged proceeds were never remitted and were commingled (settled)",
    source:
      "https://www.comicsbeat.com/cadence-comic-art-lawsuit-has-been-settled",
    rule: "The artist's share is split into trust the moment a payment lands; trust can't be moved to operating by any code",
    test: {
      file: "src/lib/escrow/journal.test.ts",
      title: "trust to operating, by any code",
    },
  },
  {
    name: "Salander-O'Reilly; Inigo Philbrick",
    year: 2019,
    status: "reported",
    what: "Works sold that the dealer didn't own, or sold more than once (guilty plea; conviction)",
    source:
      "https://www.justice.gov/usao-sdny/pr/former-art-dealer-sentenced-7-years-86-million-fraud-scheme",
    rule: "A work under an open sale can't be sold again. Fractional ownership caps are not built",
    test: {
      file: "src/app/api/routes.test.ts",
      title: "refuses to sell a work twice",
    },
  },
  {
    name: "Berry-Hill Galleries",
    year: 2005,
    status: "reported",
    what: "Pledged its art, including consigned works, to a lender (chapter 11)",
    source:
      "https://www.theartnewspaper.com/archive/debt-and-legal-troubles-force-berry-hill-galleries-to-file-for-bankruptcy",
    rule: "At insolvency, unsold consigned works go back to their artists, not into the estate",
    test: {
      file: "src/app/api/demo-flow.test.ts",
      title: "gallery goes under after payment two: the narrated numbers",
    },
  },
  {
    name: "Gibson v. Kavi Gupta; Odita v. Jack Shainman",
    year: 2023,
    status: "alleged",
    what: "Disputes over deductions, offsets of advances and a stipend deficit (allegations on both sides)",
    source:
      "https://hyperallergic.com/artist-jeffrey-gibson-sues-chicago-gallery",
    rule: "Trust only pays the artist or refunds the buyer, so an offset can't come out of it. Clause-gated deductions are not built",
    test: {
      file: "src/lib/escrow/journal.test.ts",
      title: "a buyer refund can't pay another artist",
    },
  },
  {
    name: "Knoedler",
    year: 2011,
    status: "out_of_scope",
    what: "Sold forgeries. A problem of authenticity, not of where money went",
    source:
      "https://theconversation.com/the-rise-and-fall-of-the-knoedler-new-yorks-most-notorious-art-gallery-53775",
    rule: "Out of scope: Rescrow does nothing about forgery",
    test: null,
  },
];

export interface LimitRow {
  proves: boolean;
  text: string;
  test: TestRef | null;
}

export const LIMITS: LimitRow[] = [
  {
    proves: true,
    text: "The books reconcile after every step of the demo, and after every step of 250 random histories",
    test: {
      file: "src/app/api/demo-flow.test.ts",
      title: "every intermediate step keeps the books balanced",
    },
  },
  {
    proves: true,
    text: "Only one function can change a share in trust, and it can only pay the artist or refund the buyer",
    test: {
      file: "src/lib/escrow/architecture.test.ts",
      title: "hold status changes happen in transition() and nowhere else",
    },
  },
  {
    proves: true,
    text: "A cent moved between two of an artist's shares is caught, though every total still matches",
    test: {
      file: "src/lib/escrow/plants.test.ts",
      title: "the cent shift is the one no total catches",
    },
  },
  {
    proves: true,
    text: "A bank transaction delivered twice is booked once",
    test: {
      file: "src/lib/feed/ramp.test.ts",
      title:
        "a redelivered transaction moves nothing and logs one row for the artist",
    },
  },
  {
    proves: false,
    text: "The bank feed is simulated, so the books are proven against themselves and the journal, not against a real bank balance",
    test: null,
  },
  {
    proves: false,
    text: "A closed month's seal catches later edits, not someone who rewrites the whole data file",
    test: { file: "src/lib/escrow/close.test.ts", title: "an edited entry" },
  },
  {
    proves: false,
    text: "Nothing can prove a sale that was never recorded, or a payment that never reached the gallery's Ramp account",
    test: null,
  },
  {
    proves: false,
    text: "It is not legal advice, and it doesn't decide what a court would award anyone",
    test: null,
  },
];
