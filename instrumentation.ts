/**
 * Production fail-closed boot check: refuse to start if any security-critical
 * secret is missing. Runs only at runtime start (not during the build phase).
 */
export async function register(): Promise<void> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { assertProductionEnv } = await import("@/lib/config/env");
    assertProductionEnv();
  }
}
