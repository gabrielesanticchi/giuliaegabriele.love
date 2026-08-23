import { PublicHome } from "@/components/sections/public-home";
import { WaitingPage } from "@/components/sections/waiting-page";
import { getDemoPublicContent } from "@/data/demo-content";
import { loadPublicContentSafely } from "@/lib/public-content/adapter";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const databaseContent = await loadPublicContentSafely();
  const content = databaseContent ?? getDemoPublicContent();

  if (!content) return <WaitingPage />;

  return (
    <PublicHome
      content={content}
      demoMode={!databaseContent}
      allowDemoSubmission={
        process.env.NODE_ENV !== "production" &&
        process.env.WEDDING_DEMO_MODE === "true"
      }
    />
  );
}
