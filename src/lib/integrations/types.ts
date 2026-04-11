// ─── Shared Integration Types ─────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  rowsInserted: number;
  error?: string;
  source: string;
}

// API-key based integrations (AHREFS, RANKSCALE, SEMRUSH)
export interface CredentialsApiKey {
  apiKey: string;
  projectId?: string; // used by SEMrush
}

// Helper to get today's date as YYYY-MM-DD
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Helper to get a date N days ago as YYYY-MM-DD
export function daysAgoString(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
