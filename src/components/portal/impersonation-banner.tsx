"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";

interface ImpersonationBannerProps {
  clientName: string;
  clientId: string;
}

function ImpersonationBannerInner({ clientName, clientId }: ImpersonationBannerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const isImpersonating = searchParams.get("impersonate") === "true";

  if (!isImpersonating) return null;

  return (
    <div className="sticky top-0 z-50 flex h-11 w-full items-center justify-between gap-4 bg-amber-400 px-4 text-amber-950">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span>
          Admin Preview — You are viewing this portal as{" "}
          <span className="font-bold">{clientName}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/admin/clients/${clientId}`)}
        className="flex items-center gap-1.5 rounded-md bg-amber-950/10 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-950/20 transition-colors flex-shrink-0"
      >
        <X className="h-3.5 w-3.5" />
        Exit Preview
      </button>
    </div>
  );
}

import { Suspense } from "react";

export function ImpersonationBanner({ clientName, clientId }: ImpersonationBannerProps) {
  return (
    <Suspense fallback={null}>
      <ImpersonationBannerInner clientName={clientName} clientId={clientId} />
    </Suspense>
  );
}
