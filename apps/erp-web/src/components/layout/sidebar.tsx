"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  Truck,
  ShoppingCart,
  Monitor,
  DollarSign,
  FileText,
  FolderOpen,
  BarChart3,
  Settings,
  CreditCard,
  Receipt,
  ClipboardList,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IngestionModal } from "@/components/ingestion/ingestion-modal";

const navGroups = [
  {
    label: "Visão Geral",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/products", label: "Produtos", icon: Package },
      { href: "/inventory", label: "Estoque", icon: Warehouse },
      { href: "/customers", label: "Clientes", icon: Users },
      { href: "/suppliers", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    label: "Vendas",
    items: [
      { href: "/orders", label: "Pedidos", icon: ShoppingCart },
      { href: "/sales/pos", label: "PDV", icon: Monitor },
    ],
  },
  {
    label: "Compras",
    items: [{ href: "/purchases", label: "Ordens de Compra", icon: ClipboardList }],
  },
  {
    label: "Produção",
    items: [
      { href: "/production", label: "Ordens de Produção", icon: Factory },
      { href: "/production/bom", label: "Fichas Técnicas (BOM)", icon: ClipboardList },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/finance", label: "Visão Geral", icon: DollarSign },
      { href: "/finance/payables", label: "Contas a Pagar", icon: CreditCard },
      { href: "/finance/receivables", label: "Contas a Receber", icon: Receipt },
      { href: "/finance/cash", label: "Caixa", icon: DollarSign },
    ],
  },
  {
    label: "Fiscal",
    items: [
      { href: "/fiscal/xml-import", label: "Importar XML", icon: FileText },
      { href: "/documents", label: "Documentos", icon: FolderOpen },
    ],
  },
  {
    label: "Análises",
    items: [{ href: "/reports", label: "Relatórios", icon: BarChart3 }],
  },
  {
    label: "Sistema",
    items: [{ href: "/settings", label: "Configurações", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="flex min-h-[3.25rem] items-center gap-3 border-b border-zinc-200/90 bg-white px-4 py-2 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)]">
        <Image
          src="/tribus-erp.png"
          alt=""
          width={32}
          height={32}
          priority
          aria-hidden
          className="h-8 w-8 shrink-0 self-center rounded-lg bg-white object-contain shadow-sm ring-1 ring-black/[0.06]"
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight text-zinc-900">
            Tribus ERP
          </span>
          <span
            className="mt-0.5 block truncate text-[10px] leading-tight font-medium tracking-wide text-zinc-500"
            title="Plataforma Operacional"
          >
            Plataforma Operacional
          </span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-1.5 px-3 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-zinc-100 text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-200 px-3 py-3">
        <p className="mb-1.5 px-3 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
          Ferramentas
        </p>
        <IngestionModal />
      </div>
    </aside>
  );
}
