import { getBankingAction } from "@/actions/admin/settings";

export const dynamic = "force-dynamic";

export async function POST() {
  const banking = await getBankingAction();
  return Response.json(
    { banking },
    { headers: { "cache-control": "no-store, private" } }
  );
}
