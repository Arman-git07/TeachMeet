"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/common/AppShell";

export default function ClientWrapper({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');

  return isAuthPage ? children : <AppShell>{children}</AppShell>;
}
