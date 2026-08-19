import { describe, expect, it } from "vitest";

import {
  findPostgresError,
  mapExhaustedSerializationFailure,
  TransactionError
} from "@/db/transactions/errors";

function withCode<T extends object>(message: string, extra: T): Error & T {
  return Object.assign(new Error(message), extra);
}

describe("driver error cause-chain resolution", () => {
  it("finds the SQLSTATE-coded error beneath a non-SQLSTATE wrapper", () => {
    const pg = withCode("duplicate", {
      code: "23505",
      constraint_name: "gift_locks_pkey"
    });
    const network = withCode("socket hang up", {
      code: "ECONNRESET",
      cause: pg
    });
    const wrapper = withCode("Failed query: insert ...", { cause: network });

    const resolved = findPostgresError(wrapper);
    expect(resolved?.code).toBe("23505");
    expect(resolved?.constraint_name).toBe("gift_locks_pkey");
  });

  it("maps a wrapped serialization failure to a retryable TransactionError", () => {
    const pg = withCode("could not serialize access", { code: "40001" });
    const wrapper = withCode("Failed query: insert ...", { cause: pg });

    const mapped = mapExhaustedSerializationFailure(wrapper);
    expect(mapped).toBeInstanceOf(TransactionError);
    expect((mapped as TransactionError).code).toBe("retryable");
  });

  it("does not treat a non-SQLSTATE transport error as a serialization failure", () => {
    const network = withCode("socket hang up", { code: "ECONNRESET" });
    const mapped = mapExhaustedSerializationFailure(network);
    expect(mapped).toBe(network);
    expect(mapped).not.toBeInstanceOf(TransactionError);
  });
});
