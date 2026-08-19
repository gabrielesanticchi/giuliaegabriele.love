import { PublicHome } from "@/components/sections/public-home";
import { WaitingPage } from "@/components/sections/waiting-page";
import { getDemoPublicContent } from "@/data/demo-content";

export default function HomePage() {
  const content = getDemoPublicContent();

  if (!content) return <WaitingPage />;

  return <PublicHome content={content} demoMode />;
}
