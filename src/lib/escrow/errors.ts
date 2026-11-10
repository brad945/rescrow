/** A rule of the escrow said no. Routes turn it into a 400 with its message. */
export class EscrowError extends Error {}

/** The journal refused an entry: it doesn't balance, or an account rule forbids it. */
export class LedgerRejected extends EscrowError {}
