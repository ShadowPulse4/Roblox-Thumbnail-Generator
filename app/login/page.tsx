import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/settings/auth-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { countAccountUsers } from "@/lib/database/repo";

export const metadata: Metadata = { title: "Inloggen" };

// Per-user, per-request content: never prerender at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (getConfig().authMode !== "local") redirect("/");
  if (countAccountUsers() === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="login" />;
}
