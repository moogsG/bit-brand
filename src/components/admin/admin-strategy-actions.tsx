"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AdminStrategyActionsProps {
  clientId: string;
}

export function AdminStrategyActions({ clientId }: AdminStrategyActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createStrategy = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: "SEO Strategy",
        }),
      });
      if (res.ok) {
        const strategy = await res.json() as { id: string };
        router.push(`/admin/clients/${clientId}/strategy/${strategy.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={createStrategy} disabled={loading}>
      <Plus className="h-4 w-4" />
      {loading ? "Creating..." : "New Strategy"}
    </Button>
  );
}
