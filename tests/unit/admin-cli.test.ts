import { describe, expect, it } from "vitest";

import { parseAdminCliArgs } from "@/lib/auth/admin-cli";

describe("admin CLI argument safety", () => {
  it("accepts identity and stdin mode without accepting a password argument", () => {
    expect(
      parseAdminCliArgs([
        "--email",
        "Admin@Example.com",
        "--role",
        "owner",
        "--password-stdin"
      ])
    ).toEqual({
      email: "admin@example.com",
      role: "owner",
      passwordStdin: true,
      resetRecovery: false
    });
  });

  it("rejects password values supplied on the command line", () => {
    expect(() => parseAdminCliArgs(["--password", "segreta"])).toThrow(
      "La password non può essere passata come argomento"
    );
  });
});
