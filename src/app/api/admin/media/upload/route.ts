import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { getDatabase } from "@/db";
import { mediaAssets } from "@/db/schema";
import { authorizeAdminAction } from "@/lib/admin/action-policies";
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_MEDIA_UPLOAD_BYTES
} from "@/lib/blob/policy";
import { getAdminPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Authorized direct-to-Blob upload. The client requests a scoped token here; we
 * verify the admin session and constrain the token to the media allowlist and
 * size limit (SVG and other active types are never allowed). Metadata is
 * persisted from Vercel's completion callback, which only fires when the app is
 * reachable at a public URL (production/preview), not on localhost.
 */
export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json(
      { error: "invalid_body" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const principal = await getAdminPrincipal();
        authorizeAdminAction("media.save", principal);
        return {
          allowedContentTypes: [...ALLOWED_MEDIA_CONTENT_TYPES],
          maximumSizeInBytes: MAX_MEDIA_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ adminId: principal.id })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        const meta = await head(blob.url);
        await getDatabase()
          .insert(mediaAssets)
          .values({
            pathname: blob.url,
            contentType:
              blob.contentType ??
              meta.contentType ??
              "application/octet-stream",
            sizeBytes: meta.size ?? 0,
            altText: ""
          })
          .onConflictDoNothing();
      }
    });
    return Response.json(result, {
      headers: { "cache-control": "no-store" }
    });
  } catch {
    // Never leak internal error detail to the client.
    return Response.json(
      { error: "upload_failed" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }
}
