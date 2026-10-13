"use client";

import * as React from "react";
import type { AppStatus } from "@/types/generation";
import { api } from "@/lib/api-client";

interface StatusContextValue {
  status: AppStatus;
  refresh: () => Promise<void>;
}

const StatusContext = React.createContext<StatusContextValue | null>(null);

export function StatusProvider({ initial, children }: { initial: AppStatus; children: React.ReactNode }) {
  const [status, setStatus] = React.useState(initial);
  const refresh = React.useCallback(async () => {
    try {
      setStatus(await api<AppStatus>("/api/status"));
    } catch {
      /* keep the last known status */
    }
  }, []);
  const value = React.useMemo(() => ({ status, refresh }), [status, refresh]);
  return <StatusContext value={value}>{children}</StatusContext>;
}

export function useAppStatus(): StatusContextValue {
  const ctx = React.use(StatusContext);
  if (!ctx) throw new Error("useAppStatus must be used inside StatusProvider");
  return ctx;
}
