import type { Metadata } from "next";
import { Gallery } from "@/components/gallery/gallery";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Mijn creaties" };

export default function CreationsPage() {
  return (
    <>
      <PageHeader title="Mijn creaties" subtitle="Alles wat je hebt gemaakt, alleen zichtbaar voor jou." />
      <Gallery />
    </>
  );
}
