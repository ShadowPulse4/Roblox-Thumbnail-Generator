import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusProvider } from "@/components/layout/status-provider";
import { getCurrentUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { countAccountUsers } from "@/lib/database/repo";
import { buildAppStatus } from "@/lib/services";

// Per-user, per-request content: never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const cfg = getConfig();
  const user = await getCurrentUser();
  if (!user) {
    redirect(cfg.authMode === "local" && countAccountUsers() === 0 ? "/setup" : "/login");
  }
  return (
    <StatusProvider initial={buildAppStatus(user)}>
      <AppShell>{children}</AppShell>
    </StatusProvider>
  );
}
