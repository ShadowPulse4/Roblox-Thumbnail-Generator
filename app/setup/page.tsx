import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/settings/auth-form";
import { getConfig } from "@/lib/config";
import { countAccountUsers } from "@/lib/database/repo";

export const metadata: Metadata = { title: "Eerste beheerder" };

// Per-user, per-request content: never prerender at build time.
export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (getConfig().authMode !== "local") redirect("/");
  if (countAccountUsers() > 0) redirect("/login");
  return <AuthForm mode="setup" />;
}
