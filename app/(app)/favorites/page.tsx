import type { Metadata } from "next";
import { Gallery } from "@/components/gallery/gallery";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Favorieten" };

export default function FavoritesPage() {
  return (
    <>
      <PageHeader title="Favorieten" subtitle="De thumbnails die je hebt bewaard." />
      <Gallery favoritesOnly />
    </>
  );
}
