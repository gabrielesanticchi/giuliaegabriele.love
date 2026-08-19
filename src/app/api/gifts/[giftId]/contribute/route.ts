import {
  createGiftIntentHandler,
  publicError
} from "@/lib/public-api/gift-handler";
import { createGiftRuntimeDependencies } from "@/lib/public-api/runtime-dependencies";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ giftId: string }> }
) {
  try {
    const handler = createGiftIntentHandler(
      "contribute",
      createGiftRuntimeDependencies("contribute")
    );
    return handler(request, await params);
  } catch {
    return publicError(503, "service_unavailable", { "retry-after": "60" });
  }
}
