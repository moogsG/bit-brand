"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2, TableIcon, Info } from "lucide-react";

interface SheetsExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "keywords" | "report";
  clientId: string;
  reportId?: string;
  clientName?: string;
}

type State = "idle" | "loading" | "success" | "error";

export function SheetsExportDialog({
  open,
  onOpenChange,
  type,
  clientId,
  reportId,
  clientName: _clientName,
}: SheetsExportDialogProps) {
  const [state, setState] = useState<State>("idle");
  const [accessToken, setAccessToken] = useState("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleExport() {
    if (!accessToken.trim()) return;

    setState("loading");
    setErrorMessage(null);
    setSpreadsheetUrl(null);

    try {
      const res = await fetch("/api/export/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          clientId,
          reportId,
          accessToken: accessToken.trim(),
        }),
      });

      const data = await res.json() as { spreadsheetUrl?: string; error?: string };

      if (!res.ok || !data.spreadsheetUrl) {
        setErrorMessage(data.error ?? "Export failed. Please try again.");
        setState("error");
        return;
      }

      setSpreadsheetUrl(data.spreadsheetUrl);
      setState("success");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setState("idle");
      setAccessToken("");
      setSpreadsheetUrl(null);
      setErrorMessage(null);
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-4 w-4 text-green-600" />
            Export to Google Sheets
          </DialogTitle>
          <DialogDescription>
            {type === "keywords"
              ? "Export your keyword research data to a new Google Sheets spreadsheet."
              : "Export this report's data to a new Google Sheets spreadsheet."}
          </DialogDescription>
        </DialogHeader>

        {state === "success" && spreadsheetUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              Your spreadsheet has been created successfully.
            </div>
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center no-underline")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Google Sheets
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* POC note */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2 dark:bg-blue-900/20 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0 dark:text-blue-400" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>POC Mode:</strong> Google Sheets export requires a valid OAuth 2.0 access token
                with the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">spreadsheets</code> scope.
                In production, this will use automatic Google account authentication.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-token">Google OAuth Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="ya29.a0A..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                disabled={state === "loading"}
              />
              <p className="text-xs text-muted-foreground">
                Obtain a token at{" "}
                <a
                  href="https://developers.google.com/oauthplayground"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  OAuth Playground
                </a>{" "}
                with scope:{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  https://www.googleapis.com/auth/spreadsheets
                </code>
              </p>
            </div>

            {state === "error" && errorMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {state === "success" ? "Close" : "Cancel"}
          </Button>
          {state !== "success" && (
            <Button
              onClick={handleExport}
              disabled={!accessToken.trim() || state === "loading"}
            >
              {state === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating spreadsheet...
                </>
              ) : (
                <>
                  <TableIcon className="mr-2 h-4 w-4" />
                  Create Spreadsheet
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
