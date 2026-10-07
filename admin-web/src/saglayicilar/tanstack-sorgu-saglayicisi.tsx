"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function TanStackSorguSaglayicisi({
  children,
}: {
  children: ReactNode;
}) {
  const [sorguIstemcisi] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={sorguIstemcisi}>
      {children}
    </QueryClientProvider>
  );
}
