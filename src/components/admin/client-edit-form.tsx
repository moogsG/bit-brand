"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Client } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const editClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z.string().min(1, "Domain is required"),
  industry: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

type EditClientFormData = z.infer<typeof editClientSchema>;

interface ClientEditFormProps {
  client: Client;
}

export function ClientEditForm({ client }: ClientEditFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditClientFormData>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      name: client.name,
      domain: client.domain,
      industry: client.industry ?? "",
      notes: client.notes ?? "",
      isActive: client.isActive,
    },
  });

  const onSubmit = async (data: EditClientFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to update client");
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Client updated successfully.</p>}

      <div className="space-y-1.5">
        <Label htmlFor="edit-name">Client Name</Label>
        <Input id="edit-name" {...register("name")} disabled={isLoading} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-domain">Domain</Label>
        <Input id="edit-domain" {...register("domain")} disabled={isLoading} />
        {errors.domain && (
          <p className="text-xs text-destructive">{errors.domain.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-industry">Industry</Label>
        <Input
          id="edit-industry"
          placeholder="e.g. E-commerce, SaaS"
          {...register("industry")}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-notes">Notes</Label>
        <textarea
          id="edit-notes"
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          disabled={isLoading}
          {...register("notes")}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="edit-isActive"
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          disabled={isLoading}
          {...register("isActive")}
        />
        <Label htmlFor="edit-isActive">Active</Label>
      </div>

      <Button type="submit" disabled={isLoading || !isDirty}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
