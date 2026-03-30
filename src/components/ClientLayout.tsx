"use client";

import { usePathname } from "next/navigation";
import { Providers } from "@/components/common/Providers";
import { AppShell } from "@/components/common/AppShell";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/auth");

  return (
    <Providers>
      {isAuthPage ? (
        children
      ) : (
        <AppShell>
          {children}
        </AppShell>
      )}
    </Providers>
  );
}
