"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Bell, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardRole } from "@/components/providers/dashboard-role-context";
import { IngestionModal } from "@/components/ingestion/ingestion-modal";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { isAdmin } = useDashboardRole();
  const [ingestionOpen, setIngestionOpen] = useState(false);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <h1 className="min-w-0 truncate text-lg font-semibold text-zinc-900">{title}</h1>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIngestionOpen(true)}
              className={cn(
                "hidden items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm",
                "hover:border-zinc-300 hover:bg-white hover:text-zinc-900 sm:inline-flex",
              )}
              aria-label="Nova ingestão de dados"
            >
              <Package className="h-3.5 w-3.5" />
              Ingestão
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIngestionOpen(true)}
              className="inline-flex rounded-lg border border-zinc-200 p-2 text-zinc-600 sm:hidden"
              aria-label="Ingestão"
            >
              <Package className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>
      {isAdmin && <IngestionModal open={ingestionOpen} onOpenChange={setIngestionOpen} />}
    </>
  );
}
