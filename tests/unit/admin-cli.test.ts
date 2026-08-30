import { describe, expect, it } from "vitest";

import { parseAdminCliArgs, readAdminPassword } from "@/lib/auth/admin-cli";

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
      passwordStdin: true
    });
  });

  it("rejects password values supplied on the command line", () => {
    expect(() => parseAdminCliArgs(["--password", "segreta"])).toThrow(
      "La password non può essere passata come argomento"
    );
  });

  it("fails fast (no hang) when --password-stdin runs on an interactive TTY", async () => {
    const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true
    });
    try {
      await expect(
        readAdminPassword({
          role: "owner",
          passwordStdin: true
        })
      ).rejects.toThrow(/pipe/i);
    } finally {
      if (original) Object.defineProperty(process.stdin, "isTTY", original);
    }
  });
});
