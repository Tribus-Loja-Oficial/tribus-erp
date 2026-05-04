"use client";

import { createContext, useContext } from "react";

type DashboardRoleValue = {
  isAdmin: boolean;
};

const DashboardRoleContext = createContext<DashboardRoleValue>({ isAdmin: false });

export function DashboardRoleProvider({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  return (
    <DashboardRoleContext.Provider value={{ isAdmin }}>{children}</DashboardRoleContext.Provider>
  );
}

export function useDashboardRole() {
  return useContext(DashboardRoleContext);
}
