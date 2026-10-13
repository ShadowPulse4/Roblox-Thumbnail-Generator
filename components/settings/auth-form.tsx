"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { brand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";

export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await api("/api/auth/login", { method: "POST", json: { username, password } });
      } else {
        await api("/api/auth/setup", { method: "POST", json: { username, displayName: displayName || username, password } });
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er ging iets mis.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="size-9" aria-hidden>
            <rect x="3" y="11" width="18" height="15" rx="4" transform="rotate(-8 12 18)" fill="#7c5cff" />
            <rect x="11" y="6" width="17" height="14" rx="4" transform="rotate(10 19 13)" fill="#ffd23f" />
          </svg>
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold">{brand.name}</span>
        </div>
        <h1 className="text-2xl font-semibold">{mode === "login" ? "Inloggen" : "Beheerder aanmaken"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {mode === "login"
            ? "Log in met het account dat je van de beheerder hebt gekregen."
            : "Dit is het eerste account. Daarmee kun je later accounts voor vrienden aanmaken."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Gebruikersnaam</Label>
            <Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          {mode === "setup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Naam</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Hoe je in de app heet" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="password">Wachtwoord{mode === "setup" ? " (minstens 10 tekens)" : ""}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "setup" ? 10 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {mode === "login" ? "Inloggen" : "Account aanmaken"}
          </Button>
        </form>
      </div>
    </div>
  );
}
