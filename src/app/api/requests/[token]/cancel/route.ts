import { publicError } from "@/lib/public-api/gift-handler";
import { createRequestActionHandler } from "@/lib/public-api/request-handler";
import { createRequestRuntimeDependencies } from "@/lib/public-api/runtime-dependencies";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    return createRequestActionHandler(
      "cancel",
      createRequestRuntimeDependencies()
    )(request, await params);
  } catch {
    return publicError(503, "service_unavailable", { "retry-after": "60" });
  }
}
