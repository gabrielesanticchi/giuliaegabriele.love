export type TransactionErrorCode =
  | "amount_unavailable"
  | "duplicate_request"
  | "gift_unavailable"
  | "intent_not_found"
  | "intent_not_pending"
  | "payment_already_declared"
  | "retryable";

export class TransactionError extends Error {
  constructor(
    public readonly code: TransactionErrorCode,
    public readonly httpStatus: 404 | 409 = 409
  ) {
    super(code);
    this.name = "TransactionError";
  }
}

export function mapExhaustedSerializationFailure(error: unknown): Error {
  if (error instanceof Error && "code" in error && error.code === "40001") {
    return new TransactionError("retryable");
  }
  return error instanceof Error ? error : new Error("Errore transazionale");
}
