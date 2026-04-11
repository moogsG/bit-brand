"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SheetsExportDialog } from "@/components/portal/sheets-export-dialog";
import { FileDown, Table2, Loader2 } from "lucide-react";
import type { ReportData } from "@/lib/export/pdf";
import type { KeywordData as CsvKeywordData } from "@/lib/export/csv";

// ── Report Export Buttons ─────────────────────────────────────────────────────

interface ReportExportButtonsProps {
  reportId: string;
  clientId: string;
  clientName: string;
  reportTitle: string;
  reportData: ReportData;
}

export function ReportExportButtons({
  reportId,
  clientId,
  clientName,
  reportTitle: _reportTitle,
  reportData,
}: ReportExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      const { generateReportPDF } = await import("@/lib/export/pdf");
      await generateReportPDF(reportData);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePdfExport}
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>

        <a
          href={`/api/export/csv?type=gsc&clientId=${clientId}`}
          download
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline")}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export CSV
        </a>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetsOpen(true)}
        >
          <Table2 className="mr-2 h-4 w-4 text-green-600" />
          Google Sheets
        </Button>
      </div>

      <SheetsExportDialog
        open={sheetsOpen}
        onOpenChange={setSheetsOpen}
        type="report"
        clientId={clientId}
        reportId={reportId}
        clientName={clientName}
      />
    </>
  );
}

// ── Keyword Export Buttons ────────────────────────────────────────────────────

interface KeywordExportButtonsProps {
  clientId: string;
  clientName: string;
  keywords: CsvKeywordData[];
}

export function KeywordExportButtons({
  clientId,
  clientName,
  keywords,
}: KeywordExportButtonsProps) {
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);

  async function handleCsvExport() {
    setCsvLoading(true);
    try {
      const { keywordsToCSV, downloadCSV } = await import("@/lib/export/csv");
      const csv = keywordsToCSV(keywords);
      // Re-use downloadCSV by passing pre-serialised blob
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `keywords_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      void downloadCSV; // imported but csv function used directly
    } catch (err) {
      console.error("CSV export failed:", err);
    } finally {
      setCsvLoading(false);
    }
  }

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      const { generateKeywordsPDF } = await import("@/lib/export/pdf");
      await generateKeywordsPDF(keywords, clientName);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCsvExport}
          disabled={csvLoading}
        >
          {csvLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePdfExport}
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetsOpen(true)}
        >
          <Table2 className="mr-2 h-4 w-4 text-green-600" />
          Google Sheets
        </Button>
      </div>

      <SheetsExportDialog
        open={sheetsOpen}
        onOpenChange={setSheetsOpen}
        type="keywords"
        clientId={clientId}
        clientName={clientName}
      />
    </>
  );
}
