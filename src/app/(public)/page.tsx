import { PublicHome } from "@/components/sections/public-home";
import { siteContent } from "@/data/site-content";
import { loadPublicGiftsSafely } from "@/lib/public-content/adapter";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gifts = await loadPublicGiftsSafely();
  return <PublicHome content={{ ...siteContent, gifts }} />;
}
