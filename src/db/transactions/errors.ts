export type TransactionErrorCode =
  | "amount_unavailable"
  | "gift_unavailable"
  | "intent_not_found"
  | "intent_not_pending"
  | "payment_already_declared";

export class TransactionError extends Error {
  constructor(
    public readonly code: TransactionErrorCode,
    public readonly httpStatus: 404 | 409 = 409
  ) {
    super(code);
    this.name = "TransactionError";
  }
}
