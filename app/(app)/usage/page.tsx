import type { Metadata } from "next";
import { UsageDashboard } from "@/components/usage/usage-dashboard";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Gebruik en kosten" };

export default function UsagePage() {
  return (
    <>
      <PageHeader title="Gebruik en kosten" subtitle="Wat er is gegenereerd en ongeveer wat het heeft gekost." />
      <UsageDashboard />
    </>
  );
}
