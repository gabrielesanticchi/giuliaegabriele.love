import { PublicHome } from "@/components/sections/public-home";
import { getDemoPublicContent } from "@/data/demo-content";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  await requireAdmin();
  const content = getDemoPublicContent();
  return (
    <>
      {content ? (
        <PublicHome content={content} demoMode allowDemoSubmission={false} />
      ) : null}
    </>
  );
}
