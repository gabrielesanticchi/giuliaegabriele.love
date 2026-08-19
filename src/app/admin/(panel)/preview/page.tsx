import { PublicHome } from "@/components/sections/public-home";
import { requireAdmin } from "@/lib/auth/session";
import { loadPublicContent } from "@/lib/public-content/adapter";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  await requireAdmin();
  const content = await loadPublicContent({ includeDrafts: true });
  return (
    <>
      {content ? (
        <PublicHome
          content={content}
          demoMode={false}
          allowDemoSubmission={false}
        />
      ) : (
        <p>Nessuna anteprima disponibile: completa i contenuti obbligatori.</p>
      )}
    </>
  );
}
