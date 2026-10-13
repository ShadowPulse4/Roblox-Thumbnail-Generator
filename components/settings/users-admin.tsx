"use client";

import * as React from "react";
import { KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Badge, Skeleton } from "@/components/ui/misc";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/controls";

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "member";
  dailyImageLimit: number | null;
  effectiveDailyImageLimit: number | null;
  createdAt: string;
}

function parseLimit(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ username: "", displayName: "", password: "", role: "member" as "admin" | "member", limit: "" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<AdminUser | null>(null);
  const [resetFor, setResetFor] = React.useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = React.useState("");

  const [version, setVersion] = React.useState(0);
  const load = () => setVersion((v) => v + 1);

  React.useEffect(() => {
    let alive = true;
    api<{ users: AdminUser[] }>("/api/users")
      .then((res) => alive && setUsers(res.users))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Laden is mislukt."));
    return () => {
      alive = false;
    };
  }, [version]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api("/api/users", {
        method: "POST",
        json: {
          username: form.username,
          displayName: form.displayName || form.username,
          password: form.password,
          role: form.role,
          dailyImageLimit: parseLimit(form.limit),
        },
      });
      toast.success(`Account voor ${form.username} aangemaakt. Geef het wachtwoord persoonlijk door.`);
      setAdding(false);
      setForm({ username: "", displayName: "", password: "", role: "member", limit: "" });
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Aanmaken is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function updateLimit(user: AdminUser, value: string) {
    const limit = parseLimit(value);
    if (limit === user.dailyImageLimit) return;
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", json: { dailyImageLimit: limit } });
      toast.success("Daglimiet opgeslagen.");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Opslaan is mislukt.");
    }
  }

  async function resetPassword() {
    if (!resetFor) return;
    try {
      await api(`/api/users/${resetFor.id}`, { method: "PATCH", json: { password: newPassword } });
      toast.success(`Nieuw wachtwoord ingesteld voor ${resetFor.username}.`);
      setResetFor(null);
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Opslaan is mislukt.");
    }
  }

  async function remove() {
    if (!toDelete) return;
    try {
      await api(`/api/users/${toDelete.id}`, { method: "DELETE" });
      toast.success(`${toDelete.username} verwijderd.`);
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Verwijderen is mislukt.");
    }
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!users) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-control)] border border-line">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 bg-bg-raised/50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {u.displayName} <span className="font-normal text-subtle">@{u.username}</span>
              </p>
              <p className="text-xs text-subtle">Sinds {formatDateTime(u.createdAt)}</p>
            </div>
            <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role === "admin" ? "Beheerder" : "Lid"}</Badge>
            <label className="flex items-center gap-2 text-xs text-muted">
              Daglimiet
              <Input
                defaultValue={u.dailyImageLimit ?? ""}
                placeholder={u.effectiveDailyImageLimit === null ? "geen" : `${u.effectiveDailyImageLimit} (standaard)`}
                inputMode="numeric"
                className="h-8 w-28 text-xs"
                onBlur={(e) => updateLimit(u, e.target.value)}
                aria-label={`Daglimiet voor ${u.username}`}
              />
            </label>
            <Button size="icon-sm" variant="ghost" onClick={() => setResetFor(u)} aria-label={`Wachtwoord van ${u.username} resetten`} title="Wachtwoord resetten">
              <KeyRound />
            </Button>
            {u.id !== currentUserId ? (
              <Button size="icon-sm" variant="ghost" onClick={() => setToDelete(u)} aria-label={`${u.username} verwijderen`} title="Verwijderen">
                <Trash2 />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-subtle">Laat de daglimiet leeg voor de standaard uit DAILY_IMAGE_LIMIT_PER_USER. Beheerders hebben standaard geen daglimiet.</p>

      <Button onClick={() => setAdding(true)}>
        <UserPlus />
        Vriend toevoegen
      </Button>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title="Vriend toevoegen" description="Maak een account aan en geef de gebruikersnaam en het wachtwoord persoonlijk door.">
          <form onSubmit={addUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nu-username">Gebruikersnaam</Label>
                <Input id="nu-username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-name">Naam</Label>
                <Input id="nu-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-password">Wachtwoord (minstens 10 tekens)</Label>
              <Input id="nu-password" type="text" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Segmented
                  size="sm"
                  label="Rol"
                  value={form.role}
                  onChange={(v) => setForm({ ...form, role: v })}
                  options={[
                    { value: "member", label: "Lid" },
                    { value: "admin", label: "Beheerder" },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-limit">Daglimiet (leeg = standaard)</Label>
                <Input id="nu-limit" inputMode="numeric" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
              </div>
            </div>
            <FieldError>{formError}</FieldError>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Annuleren
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Account aanmaken
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetFor !== null} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent title="Wachtwoord resetten" description={`Nieuw wachtwoord voor ${resetFor?.username ?? ""}. Die wordt overal uitgelogd.`}>
          <div className="space-y-4">
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minstens 10 tekens" aria-label="Nieuw wachtwoord" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResetFor(null)}>
                Annuleren
              </Button>
              <Button variant="primary" onClick={resetPassword} disabled={newPassword.length < 10}>
                Wachtwoord opslaan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`${toDelete?.username ?? ""} verwijderen?`}
        description="Het account en de lijst met creaties verdwijnen uit de app. De bestanden blijven op de server staan."
        confirmLabel="Verwijderen"
        onConfirm={remove}
      />
    </div>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/account", { method: "PATCH", json: { currentPassword: current, newPassword: next } });
      toast.success("Wachtwoord gewijzigd.");
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Wijzigen is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">Huidig wachtwoord</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-new">Nieuw wachtwoord</Label>
        <Input id="pw-new" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy}>
        Wijzigen
      </Button>
      <div className="sm:col-span-3">
        <FieldError>{error}</FieldError>
      </div>
    </form>
  );
}
