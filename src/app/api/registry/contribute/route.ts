import {
  createRegistryContributionHandler,
  publicError
} from "@/lib/public-api/gift-handler";
import { createRegistryContributionRuntimeDependencies } from "@/lib/public-api/runtime-dependencies";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const handler = createRegistryContributionHandler(
      createRegistryContributionRuntimeDependencies()
    );
    return handler(request);
  } catch {
    return publicError(503, "service_unavailable", { "retry-after": "60" });
  }
}
