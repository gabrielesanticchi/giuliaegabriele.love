import { getBankingAction } from "@/actions/admin/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin =
      Boolean(configuredOrigin && origin) &&
      new URL(origin!).origin === new URL(configuredOrigin!).origin;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) {
    return Response.json(
      { error: "forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }
  const banking = await getBankingAction();
  return Response.json(
    { banking },
    { headers: { "cache-control": "no-store, private" } }
  );
}
