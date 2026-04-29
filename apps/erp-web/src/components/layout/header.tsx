"use client";

import { signOut } from "next-auth/react";
import { LogOut, Bell } from "lucide-react";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          <Bell className="h-4 w-4" />
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
