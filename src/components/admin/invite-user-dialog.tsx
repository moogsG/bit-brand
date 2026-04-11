"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Check } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  clientId: z.string().min(1, "Client is required"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  /** Pre-selected client ID — if provided, the client selector is hidden */
  clientId?: string;
  /** All clients for selector (only needed when clientId is not pre-set) */
  clients?: { id: string; name: string }[];
}

export function InviteUserDialog({ clientId, clients = [] }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { clientId: clientId ?? "" },
  });

  const onSubmit = async (data: InviteFormData) => {
    setIsLoading(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, clientId: data.clientId }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to send invitation");
      }
      const json = await res.json() as { inviteUrl: string };
      setInviteUrl(json.inviteUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      reset({ clientId: clientId ?? "" });
      setInviteUrl(null);
      setError(null);
    }
    setOpen(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="h-4 w-4" />
        Invite User
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Portal User</DialogTitle>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Invitation created. Share this link with your client:
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
              <code className="flex-1 text-xs break-all font-mono">{inviteUrl}</code>
            </div>
            <Button onClick={copyLink} className="w-full gap-2">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="client@example.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Client selector — only shown if no clientId is pre-selected */}
            {!clientId && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-client">Client *</Label>
                <select
                  id="invite-client"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring"
                  disabled={isLoading}
                  {...register("clientId")}
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-xs text-destructive">{errors.clientId.message}</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
