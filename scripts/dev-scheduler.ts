// Run with: bun run scripts/dev-scheduler.ts
// Triggers weekly sync endpoint every 60 seconds for local dev testing

const CRON_SECRET = process.env.CRON_SECRET;
const INTERVAL = parseInt(process.argv[2] || "60", 10) * 1000;
const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

if (!CRON_SECRET) {
	console.error("[dev-scheduler] CRON_SECRET not set in .env.local");
	process.exit(1);
}

async function triggerWeeklySync() {
	const timestamp = new Date().toISOString();
  console.info(`[dev-scheduler] ${timestamp} — Triggering weekly sync...`);

	try {
		const response = await fetch(`${BASE_URL}/api/cron/weekly-sync`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${CRON_SECRET}`,
			},
		});

    const result = await response.json();
    console.info(
      `[dev-scheduler] ${response.status}:`,
      JSON.stringify(result, null, 2),
    );
  } catch (error) {
    console.error("[dev-scheduler] Error:", error);
  }
}

// Run immediately
triggerWeeklySync();

// Then repeat on interval
setInterval(triggerWeeklySync, INTERVAL);

console.info(
  `[dev-scheduler] Running every ${INTERVAL / 1000}s. Press Ctrl+C to stop.`,
);
