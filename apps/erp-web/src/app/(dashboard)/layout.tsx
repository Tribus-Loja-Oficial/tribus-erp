import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardRoleProvider } from "@/components/providers/dashboard-role-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user ? (session.user as { role?: string }).role : undefined;
  const isAdmin = role === "admin";

  return (
    <DashboardRoleProvider isAdmin={isAdmin}>
      <div className="flex h-screen overflow-hidden bg-zinc-50">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </DashboardRoleProvider>
  );
}
