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

export type PostgresError = Error & {
  code?: string;
  constraint_name?: string;
};

// A Postgres SQLSTATE is exactly five characters drawn from digits and
// uppercase letters (e.g. 40001, 23505). Matching this shape avoids mistaking a
// transport/wrapper error code such as "ECONNRESET" for a database error code.
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

/**
 * drizzle wraps driver failures in an error whose `.cause` carries the real
 * postgres error (bearing `code`/`constraint_name`). Walk the cause chain and
 * return the first error whose `code` looks like a Postgres SQLSTATE, so a
 * non-SQLSTATE wrapper in the middle of the chain cannot mask the real code.
 * Falls back to the original error when no SQLSTATE-shaped code is present.
 */
export function findPostgresError(error: unknown): PostgresError | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    const code = (current as PostgresError).code;
    if (typeof code === "string" && SQLSTATE_PATTERN.test(code)) {
      return current as PostgresError;
    }
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return error instanceof Error ? (error as PostgresError) : undefined;
}

export function mapExhaustedSerializationFailure(error: unknown): Error {
  if (findPostgresError(error)?.code === "40001") {
    return new TransactionError("retryable");
  }
  return error instanceof Error ? error : new Error("Errore transazionale");
}
