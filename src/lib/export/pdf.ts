/**
 * PDF generation utilities — client-side only.
 * Import ONLY inside "use client" components.
 */

export interface ReportData {
  clientName: string;
  month: string; // e.g. "March 2025"
  executiveSummary?: string;
  trafficOverview: {
    sessions: number;
    users: number;
    pageviews: number;
    organicSessions: number;
  };
  searchPerformance: {
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
  };
  topKeywords: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  backlinkProfile: {
    domainRating: number | null;
    backlinks: number;
    referringDomains: number;
    organicKeywords: number;
  };
  aiVisibilityScore: number | null;
  wins?: string;
  opportunities?: string;
  nextMonthGoals?: string;
}

export interface KeywordData {
  keyword: string;
  monthlyVolume: number | null;
  difficulty: number | null;
  intent: string | null;
  priority: string | null;
  currentPosition: number | null;
  targetPosition: number | null;
  status: string | null;
}

export async function generateReportPDF(report: ReportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Helper functions ──────────────────────────────────────────────────────

  function addPageIfNeeded(needed = 30) {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  }

  function drawSectionHeader(title: string, color: [number, number, number] = [99, 102, 241]) {
    addPageIfNeeded(18);
    doc.setFillColor(...color);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 5.5);
    doc.setTextColor(30, 30, 30);
    y += 12;
  }

  function drawMetricGrid(
    metrics: Array<{ label: string; value: string }>,
    columns = 4
  ) {
    const cellW = contentWidth / columns;
    metrics.forEach((m, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = margin + col * cellW;
      const rowY = y + row * 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(m.value, x + 2, rowY + 7);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(m.label, x + 2, rowY + 13);
    });
    const rows = Math.ceil(metrics.length / columns);
    y += rows * 18 + 4;
  }

  function drawBodyText(text: string) {
    addPageIfNeeded(20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += (lines.length as number) * 4.5 + 4;
  }

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(17, 17, 27);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BIT Brand Anarchy", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 220);
  doc.text(`${report.clientName}  ·  Monthly Report — ${report.month}`, margin, 20);
  y = 36;

  // ── Section 1: Executive Summary ──────────────────────────────────────────
  if (report.executiveSummary) {
    drawSectionHeader("Executive Summary");
    drawBodyText(report.executiveSummary);
    y += 4;
  }

  // ── Section 2: Traffic Overview ───────────────────────────────────────────
  drawSectionHeader("Traffic Overview");
  drawMetricGrid([
    { label: "Sessions", value: report.trafficOverview.sessions.toLocaleString() },
    { label: "Users", value: report.trafficOverview.users.toLocaleString() },
    { label: "Pageviews", value: report.trafficOverview.pageviews.toLocaleString() },
    { label: "Organic Sessions", value: report.trafficOverview.organicSessions.toLocaleString() },
  ]);

  // ── Section 3: Search Performance ─────────────────────────────────────────
  drawSectionHeader("Search Performance");
  drawMetricGrid([
    { label: "Total Clicks", value: report.searchPerformance.totalClicks.toLocaleString() },
    { label: "Impressions", value: report.searchPerformance.totalImpressions.toLocaleString() },
    { label: "Avg. Position", value: report.searchPerformance.avgPosition.toFixed(1) },
  ], 3);

  // ── Section 4: Top Keywords ────────────────────────────────────────────────
  if (report.topKeywords.length > 0) {
    addPageIfNeeded(40);
    drawSectionHeader("Top Keywords");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Query", "Clicks", "Impressions", "CTR", "Position"]],
      body: report.topKeywords.map((kw) => [
        kw.query,
        kw.clicks.toLocaleString(),
        kw.impressions.toLocaleString(),
        `${(kw.ctr * 100).toFixed(1)}%`,
        kw.position.toFixed(1),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 255] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Section 5: Backlink Profile ────────────────────────────────────────────
  addPageIfNeeded(30);
  drawSectionHeader("Backlink Profile");
  drawMetricGrid([
    { label: "Domain Rating", value: report.backlinkProfile.domainRating !== null ? String(Math.round(report.backlinkProfile.domainRating)) : "—" },
    { label: "Backlinks", value: report.backlinkProfile.backlinks.toLocaleString() },
    { label: "Referring Domains", value: report.backlinkProfile.referringDomains.toLocaleString() },
    { label: "Organic Keywords", value: report.backlinkProfile.organicKeywords.toLocaleString() },
  ]);

  // ── Section 6: AI Visibility ───────────────────────────────────────────────
  addPageIfNeeded(25);
  drawSectionHeader("AI Search Visibility");
  const aiScore = report.aiVisibilityScore !== null ? String(Math.round(report.aiVisibilityScore)) : "—";
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text(aiScore, margin + 2, y + 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Overall AI Visibility Score (0–100)", margin + 18, y + 10);
  y += 20;

  // ── Section 7-9: Text sections ────────────────────────────────────────────
  const textSections = [
    { title: "Wins This Month", content: report.wins },
    { title: "Opportunities", content: report.opportunities },
    { title: "Next Month Goals", content: report.nextMonthGoals },
  ];
  for (const s of textSections) {
    if (s.content) {
      addPageIfNeeded(30);
      drawSectionHeader(s.title, [30, 30, 60]);
      drawBodyText(s.content);
      y += 4;
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated by BIT Brand Anarchy Portal — ${today}`, margin, footerY);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: "right" });
  }

  const filename = `BBA_Report_${report.clientName.replace(/\s+/g, "_")}_${report.month.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

export async function generateKeywordsPDF(keywords: KeywordData[], clientName: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  // Header
  doc.setFillColor(17, 17, 27);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("BIT Brand Anarchy — Keyword Research", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 220);
  doc.text(`Client: ${clientName}  ·  ${today}`, margin, 17);

  autoTable(doc, {
    startY: 28,
    margin: { left: margin, right: margin },
    head: [["Keyword", "Volume/mo", "Difficulty", "Intent", "Priority", "Cur. Pos.", "Target Pos.", "Status"]],
    body: keywords.map((kw) => [
      kw.keyword,
      kw.monthlyVolume !== null ? kw.monthlyVolume.toLocaleString() : "—",
      kw.difficulty !== null ? String(kw.difficulty) : "—",
      kw.intent ?? "—",
      kw.priority ?? "—",
      kw.currentPosition !== null ? `#${kw.currentPosition}` : "—",
      kw.targetPosition !== null ? `#${kw.targetPosition}` : "—",
      kw.status ?? "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated by BIT Brand Anarchy Portal — ${today}`, margin, footerY);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: "right" });
  }

  const filename = `BBA_Keywords_${clientName.replace(/\s+/g, "_")}_${today.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
