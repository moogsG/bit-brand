"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, X } from "lucide-react";
import { generateNorthStarSuggestion } from "@/lib/onboarding/north-star";

const createClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  domain: z.string().min(1, "Domain is required"),
  industry: z.string().optional(),
  notes: z.string().optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

type WizardStep = "client" | "competitors" | "northStar" | "complete";

interface CreatedClient {
  id: string;
  name: string;
}

interface CompetitorDraft {
  name: string;
  domain: string;
}

interface NorthStarDraft {
  statement: string;
  metricName: string;
  targetValue: string;
  targetDate: string;
}

const defaultCompetitorDraft: CompetitorDraft = {
  name: "",
  domain: "",
};

const defaultNorthStarDraft: NorthStarDraft = {
  statement: "",
  metricName: "",
  targetValue: "",
  targetDate: "",
};

export function CreateClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("client");
  const [createdClient, setCreatedClient] = useState<CreatedClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([
    { ...defaultCompetitorDraft },
  ]);
  const [shouldAddNorthStar, setShouldAddNorthStar] = useState(false);
  const [northStar, setNorthStar] = useState<NorthStarDraft>({
    ...defaultNorthStarDraft,
  });
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
  });

  function resetWizardState() {
    setStep("client");
    setCreatedClient(null);
    setCompetitors([{ ...defaultCompetitorDraft }]);
    setShouldAddNorthStar(false);
    setNorthStar({ ...defaultNorthStarDraft });
    setError(null);
    reset();
  }

  async function saveOnboardingDraft(payload: Record<string, unknown>) {
    if (!createdClient) {
      throw new Error("Client record is missing");
    }

    const res = await fetch(`/api/onboarding/${createdClient.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT", ...payload }),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "Failed to save onboarding draft");
    }
  }

  function applyGeneratedNorthStarSuggestion() {
    const formValues = getValues();
    const suggestion = generateNorthStarSuggestion({
      businessName: formValues.name,
      industry: formValues.industry,
      primaryOffer: null,
      primaryConversion: "qualified leads",
      monthlyLeads: null,
      competitorCount: competitors.filter((competitor) => competitor.name.trim().length > 0)
        .length,
    });

    setNorthStar({
      statement: suggestion.statement,
      metricName: suggestion.metricName,
      targetValue: suggestion.targetValue !== null ? String(suggestion.targetValue) : "",
      targetDate: suggestion.targetDate ?? "",
    });
  }

  const onSubmit = async (data: CreateClientFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to create client");
      }

      const client = (await res.json()) as CreatedClient;
      setCreatedClient(client);
      setStep("competitors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const saveCompetitorsAndContinue = async () => {
    setIsSavingStep(true);
    setError(null);

    try {
      const cleaned = competitors
        .map((competitor) => ({
          name: competitor.name.trim(),
          domain: competitor.domain.trim(),
        }))
        .filter((competitor) => competitor.name.length > 0)
        .map((competitor) => ({
          name: competitor.name,
          domain: competitor.domain.length > 0 ? competitor.domain : null,
          positioning: null,
          strengths: null,
          weaknesses: null,
        }));

      if (cleaned.length > 0) {
        await saveOnboardingDraft({ competitors: cleaned });
      }

      setStep("northStar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save competitors");
    } finally {
      setIsSavingStep(false);
    }
  };

  const saveNorthStarAndFinish = async () => {
    setIsSavingStep(true);
    setError(null);

    try {
      if (shouldAddNorthStar) {
        const statement = northStar.statement.trim();
        if (statement.length === 0) {
          throw new Error("North Star statement is required");
        }

        const targetValueRaw = northStar.targetValue.trim();
        const targetValueNumber = Number(targetValueRaw);
        const targetValue = targetValueRaw.length > 0 && Number.isFinite(targetValueNumber)
          ? targetValueNumber
          : null;

        await saveOnboardingDraft({
          northStarGoal: {
            statement,
            metricName: northStar.metricName.trim() || null,
            currentValue: null,
            targetValue,
            targetDate: northStar.targetDate.trim() || null,
            timeHorizonMonths: null,
            confidenceNotes: null,
          },
        });
      }

      setStep("complete");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save North Star");
    } finally {
      setIsSavingStep(false);
    }
  };

  const closeWizard = () => {
    setOpen(false);
    resetWizardState();
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeWizard();
          return;
        }

        setOpen(true);
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        Add Client
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "client" && "Add New Client"}
            {step === "competitors" && "Step 2: Add Competitors"}
            {step === "northStar" && "Step 3: North Star Goal"}
            {step === "complete" && "Client Added"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            {step === "client" && "Step 1 of 3: add core client details."}
            {step === "competitors" && "Step 2 of 3: add competitors now or skip and do it manually later."}
            {step === "northStar" && "Step 3 of 3: optionally set the North Star now."}
            {step === "complete" && "You can continue setup now or leave it for later."}
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {step === "client" && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  placeholder="Acme Corp"
                  {...register("name")}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="domain">Domain *</Label>
                <Input
                  id="domain"
                  placeholder="acme.com"
                  {...register("domain")}
                  disabled={isLoading}
                />
                {errors.domain && (
                  <p className="text-xs text-destructive">{errors.domain.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g. E-commerce, SaaS"
                  {...register("industry")}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Optional notes about this client..."
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
                  disabled={isLoading}
                  {...register("notes")}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeWizard}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create and Continue"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "competitors" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {competitors.map((competitor, index) => (
                  <div key={`competitor-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      placeholder="Competitor name"
                      value={competitor.name}
                      disabled={isSavingStep}
                      onChange={(event) => {
                        const next = [...competitors];
                        next[index] = { ...next[index], name: event.target.value };
                        setCompetitors(next);
                      }}
                    />
                    <Input
                      placeholder="competitor.com"
                      value={competitor.domain}
                      disabled={isSavingStep}
                      onChange={(event) => {
                        const next = [...competitors];
                        next[index] = { ...next[index], domain: event.target.value };
                        setCompetitors(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isSavingStep || competitors.length === 1}
                      onClick={() => {
                        setCompetitors((prev) => prev.filter((_, row) => row !== index));
                      }}
                      aria-label="Remove competitor"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setCompetitors((prev) => [...prev, { ...defaultCompetitorDraft }])
                }
                disabled={isSavingStep}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Competitor
              </Button>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeWizard}
                  disabled={isSavingStep}
                >
                  Exit wizard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("northStar")}
                  disabled={isSavingStep}
                >
                  Skip for now
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveCompetitorsAndContinue()}
                  disabled={isSavingStep}
                >
                  {isSavingStep ? "Saving..." : "Save and Continue"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "northStar" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm">Would you like to add a North Star goal now?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={shouldAddNorthStar ? "default" : "outline"}
                    onClick={() => {
                      setShouldAddNorthStar(true);
                      applyGeneratedNorthStarSuggestion();
                    }}
                    disabled={isSavingStep}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={!shouldAddNorthStar ? "default" : "outline"}
                    onClick={() => setShouldAddNorthStar(false)}
                    disabled={isSavingStep}
                  >
                    Not now
                  </Button>
                </div>
              </div>

              {shouldAddNorthStar && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      We draft this for you using the client and competitor details. You can refine before saving.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSavingStep}
                      onClick={applyGeneratedNorthStarSuggestion}
                    >
                      Regenerate
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="north-star-statement">North Star statement *</Label>
                    <Input
                      id="north-star-statement"
                      placeholder="e.g. Double qualified inbound demos in 6 months"
                      value={northStar.statement}
                      disabled={isSavingStep}
                      onChange={(event) =>
                        setNorthStar((prev) => ({ ...prev, statement: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="north-star-metric">Metric name</Label>
                      <Input
                        id="north-star-metric"
                        placeholder="Qualified demos"
                        value={northStar.metricName}
                        disabled={isSavingStep}
                        onChange={(event) =>
                          setNorthStar((prev) => ({ ...prev, metricName: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="north-star-target-value">Target value</Label>
                      <Input
                        id="north-star-target-value"
                        inputMode="decimal"
                        placeholder="120"
                        value={northStar.targetValue}
                        disabled={isSavingStep}
                        onChange={(event) =>
                          setNorthStar((prev) => ({ ...prev, targetValue: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="north-star-target-date">Target date</Label>
                    <Input
                      id="north-star-target-date"
                      placeholder="2026-12-31"
                      value={northStar.targetDate}
                      disabled={isSavingStep}
                      onChange={(event) =>
                        setNorthStar((prev) => ({ ...prev, targetDate: event.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeWizard}
                  disabled={isSavingStep}
                >
                  Exit wizard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("complete")}
                  disabled={isSavingStep}
                >
                  Skip and finish
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveNorthStarAndFinish()}
                  disabled={isSavingStep}
                >
                  {isSavingStep ? "Saving..." : shouldAddNorthStar ? "Save and Finish" : "Finish"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "complete" && createdClient && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{createdClient.name}</span> is ready.
                You can continue in the full onboarding flow now, or come back later and complete it manually.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeWizard}>
                  Done for now
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    router.push(`/admin/clients/${createdClient.id}/onboarding`);
                    closeWizard();
                  }}
                >
                  Open Full Onboarding
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
