import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";
import { db } from "./index";

// Ensure environment variables from .env.local are loaded when running via tsx
loadEnvConfig(process.cwd());
import {
	aiVisibility,
	apiCredentials,
	clients,
	clientUsers,
	dataSources,
	ga4Metrics,
	gscMetrics,
	keywordResearch,
	monthlyReports,
	mozMetrics,
	rankscaleMetrics,
	seoStrategies,
	syncJobs,
	users,
	roles,
	approvalPolicies,
	kanbanColumns,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return d.toISOString().split("T")[0];
}

function rand(min: number, max: number): number {
	return Math.round(min + Math.random() * (max - min));
}

function randFloat(min: number, max: number, dp = 2): number {
	return parseFloat((min + Math.random() * (max - min)).toFixed(dp));
}

function trend(
	base: number,
	day: number,
	totalDays: number,
	growthPct: number,
): number {
	const progress = day / totalDays;
	return Math.round(
		base * (1 + progress * (growthPct / 100)) +
			(Math.random() - 0.5) * base * 0.12,
	);
}

// ─── Admin user ───────────────────────────────────────────────────────────────

async function seedAdmin() {
	const adminEmail = "admin@bitbrandanarchy.com";
	const existing = await db
		.select()
		.from(users)
		.where(eq(users.email, adminEmail))
		.get();

	if (existing) {
		console.log("✅ Admin user already exists");
		return existing;
	}

	const passwordHash = await bcrypt.hash("admin123!", 12);
	const [admin] = await db
		.insert(users)
		.values({
			email: adminEmail,
			name: "BBA Admin",
			passwordHash,
			role: "ADMIN",
		})
		.returning();

	console.log("✅ Admin user created — admin@bitbrandanarchy.com / admin123!");
	return admin;
}

// ─── Demo client ─────────────────────────────────────────────────────────────

async function seedDemoClient(adminId: string) {
	const slug = "acme-corp";
	const existing = await db
		.select()
		.from(clients)
		.where(eq(clients.slug, slug))
		.get();

	if (existing) {
		console.log("✅ Demo client already exists:", existing.name);
		return existing;
	}

	const [client] = await db
		.insert(clients)
		.values({
			name: "Acme Corp",
			domain: "acmecorp.com",
			slug,
			industry: "E-commerce",
			notes: "Demo client with full seed data. Safe to reset.",
			isActive: true,
			createdBy: adminId,
		})
		.returning();

	console.log("✅ Demo client created:", client.name);
	return client;
}

// ─── Demo client user ─────────────────────────────────────────────────────────

async function seedClientUser(clientId: string) {
	const email = "client@acmecorp.com";
	let clientUser = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.get();

	if (!clientUser) {
		const passwordHash = await bcrypt.hash("client123!", 12);
		const [u] = await db
			.insert(users)
			.values({ email, name: "Acme Corp Client", passwordHash, role: "CLIENT" })
			.returning();
		clientUser = u;
		console.log("✅ Client user created — client@acmecorp.com / client123!");
	} else {
		console.log("✅ Client user already exists");
	}

	// Link to client
	const existingLink = await db
		.select()
		.from(clientUsers)
		.where(eq(clientUsers.userId, clientUser.id))
		.get();

	if (!existingLink) {
		await db.insert(clientUsers).values({ clientId, userId: clientUser.id });
	}

	return clientUser;
}

// ─── GA4 metrics (last 90 days) ───────────────────────────────────────────────

async function seedGA4(clientId: string) {
	const DAYS = 90;
	const baseSession = 1600;

	const rows = [];
	for (let i = DAYS; i >= 0; i--) {
		const date = dateStr(i);
		// Check if already seeded
		const sessions = trend(baseSession, DAYS - i, DAYS, 28); // +28% over 90 days
		const users = Math.round(sessions * randFloat(0.82, 0.92, 3));
		const newUsers = Math.round(users * randFloat(0.55, 0.7, 3));
		const pageviews = Math.round(sessions * randFloat(2.8, 3.6, 3));
		const organicSessions = Math.round(sessions * randFloat(0.6, 0.72, 3));
		const bounceRate = randFloat(0.38, 0.52, 3);
		const avgSessionDuration = randFloat(95, 165, 1);

		rows.push({
			clientId,
			date,
			sessions,
			users,
			newUsers,
			pageviews,
			organicSessions,
			bounceRate,
			avgSessionDuration,
		});
	}

	// Insert in batches to avoid conflicts (ignore on conflict)
	for (const row of rows) {
		await db.insert(ga4Metrics).values(row).onConflictDoNothing();
	}

	console.log(`✅ GA4 metrics seeded (${rows.length} days)`);
}

// ─── GSC metrics (last 90 days, 20 queries) ──────────────────────────────────

const GSC_QUERIES = [
	{
		query: "best ecommerce platform",
		baseClicks: 62,
		baseImpr: 1800,
		baseCtr: 0.034,
		basePos: 8.2,
	},
	{
		query: "buy widgets online",
		baseClicks: 95,
		baseImpr: 2200,
		baseCtr: 0.043,
		basePos: 5.4,
	},
	{
		query: "acmecorp reviews",
		baseClicks: 145,
		baseImpr: 1100,
		baseCtr: 0.132,
		basePos: 2.1,
	},
	{
		query: "affordable widget supplier",
		baseClicks: 38,
		baseImpr: 980,
		baseCtr: 0.039,
		basePos: 11.3,
	},
	{
		query: "widget delivery australia",
		baseClicks: 72,
		baseImpr: 1650,
		baseCtr: 0.044,
		basePos: 6.7,
	},
	{
		query: "online widget store",
		baseClicks: 118,
		baseImpr: 3100,
		baseCtr: 0.038,
		basePos: 7.9,
	},
	{
		query: "custom widgets manufacturer",
		baseClicks: 29,
		baseImpr: 720,
		baseCtr: 0.04,
		basePos: 14.2,
	},
	{
		query: "widget comparison 2025",
		baseClicks: 54,
		baseImpr: 1420,
		baseCtr: 0.038,
		basePos: 9.1,
	},
	{
		query: "ecommerce seo tips",
		baseClicks: 21,
		baseImpr: 890,
		baseCtr: 0.024,
		basePos: 16.4,
	},
	{
		query: "product page seo",
		baseClicks: 17,
		baseImpr: 760,
		baseCtr: 0.022,
		basePos: 18.2,
	},
	{
		query: "bulk widget order",
		baseClicks: 83,
		baseImpr: 1980,
		baseCtr: 0.042,
		basePos: 5.8,
	},
	{
		query: "acme corp contact",
		baseClicks: 88,
		baseImpr: 560,
		baseCtr: 0.157,
		basePos: 1.8,
	},
	{
		query: "widget price list",
		baseClicks: 44,
		baseImpr: 1100,
		baseCtr: 0.04,
		basePos: 10.5,
	},
	{
		query: "free shipping widgets",
		baseClicks: 67,
		baseImpr: 1890,
		baseCtr: 0.035,
		basePos: 8.8,
	},
	{
		query: "eco friendly products online",
		baseClicks: 32,
		baseImpr: 940,
		baseCtr: 0.034,
		basePos: 13.1,
	},
	{
		query: "australian ecommerce shop",
		baseClicks: 57,
		baseImpr: 1560,
		baseCtr: 0.037,
		basePos: 9.4,
	},
	{
		query: "widget installation guide",
		baseClicks: 41,
		baseImpr: 1240,
		baseCtr: 0.033,
		basePos: 11.7,
	},
	{
		query: "same day delivery widgets",
		baseClicks: 28,
		baseImpr: 820,
		baseCtr: 0.034,
		basePos: 15.6,
	},
	{
		query: "business widget solutions",
		baseClicks: 19,
		baseImpr: 640,
		baseCtr: 0.03,
		basePos: 19.3,
	},
	{
		query: "widget warranty policy",
		baseClicks: 35,
		baseImpr: 880,
		baseCtr: 0.04,
		basePos: 7.2,
	},
];

async function seedGSC(clientId: string) {
	const DAYS = 90;
	const rows = [];

	for (let i = DAYS; i >= 0; i--) {
		const date = dateStr(i);
		for (const q of GSC_QUERIES) {
			const progress = (DAYS - i) / DAYS;
			const growthMult = 1 + progress * 0.2; // +20% growth over 90 days
			const clicks = Math.max(
				0,
				Math.round(q.baseClicks * growthMult * randFloat(0.7, 1.3, 3)),
			);
			const impressions = Math.max(
				1,
				Math.round(q.baseImpr * growthMult * randFloat(0.8, 1.2, 3)),
			);
			const ctr = parseFloat((clicks / impressions).toFixed(4));
			const position = Math.max(
				1,
				parseFloat((q.basePos * randFloat(0.88, 1.12, 2)).toFixed(1)),
			);

			rows.push({
				clientId,
				date,
				query: q.query,
				clicks,
				impressions,
				ctr,
				position,
			});
		}
	}

	for (const row of rows) {
		await db.insert(gscMetrics).values(row).onConflictDoNothing();
	}

	console.log(`✅ GSC metrics seeded (${rows.length} rows)`);
}

// ─── Moz metrics (last 90 days) ──────────────────────────────────────────────

async function seedMoz(clientId: string) {
	const DAYS = 90;
	const rows = [];

	for (let i = DAYS; i >= 0; i--) {
		const date = dateStr(i);
		const progress = (DAYS - i) / DAYS;
		const da = Math.round(35 + progress * 7 + (Math.random() - 0.5) * 1.2);
		const pa = Math.round(da * randFloat(0.65, 0.8, 2));
		const spamScore = rand(1, 5);
		const brandAuthority = rand(20, 60);
		const backlinks = trend(1200, DAYS - i, DAYS, 25);
		const referringDomains = trend(180, DAYS - i, DAYS, 20);
		const organicKeywords = trend(420, DAYS - i, DAYS, 35);
		const organicTraffic = trend(8200, DAYS - i, DAYS, 28);

		rows.push({
			clientId,
			date,
			domainAuthority: da,
			pageAuthority: pa,
			spamScore,
			brandAuthority,
			backlinks,
			referringDomains,
			organicKeywords,
			organicTraffic,
		});
	}

	for (const row of rows) {
		await db.insert(mozMetrics).values(row).onConflictDoNothing();
	}

	console.log(`✅ Moz metrics seeded (${rows.length} rows)`);
}

// ─── Keyword research (15 keywords) ──────────────────────────────────────────

async function seedKeywords(clientId: string, adminId: string) {
	const KEYWORDS = [
		{
			keyword: "best ecommerce platform australia",
			monthlyVolume: 2900,
			difficulty: 52,
			intent: "COMMERCIAL" as const,
			priority: "HIGH" as const,
			currentPosition: 11,
			targetPosition: 5,
			targetUrl: "https://acmecorp.com/blog/best-ecommerce-platform",
			status: "TARGETING" as const,
			notes: "Key comparison article opportunity. Currently ranking page 2.",
		},
		{
			keyword: "buy widgets online",
			monthlyVolume: 1600,
			difficulty: 38,
			intent: "TRANSACTIONAL" as const,
			priority: "HIGH" as const,
			currentPosition: 5,
			targetPosition: 2,
			targetUrl: "https://acmecorp.com/shop",
			status: "RANKING" as const,
			notes: "Strong position. Optimise title tag and add structured data.",
		},
		{
			keyword: "affordable widget supplier",
			monthlyVolume: 880,
			difficulty: 28,
			intent: "COMMERCIAL" as const,
			priority: "HIGH" as const,
			currentPosition: 12,
			targetPosition: 5,
			targetUrl: "https://acmecorp.com/products",
			status: "TARGETING" as const,
			notes: "Low difficulty. Build 5 more backlinks to push to page 1.",
		},
		{
			keyword: "widget delivery australia",
			monthlyVolume: 1200,
			difficulty: 33,
			intent: "TRANSACTIONAL" as const,
			priority: "MEDIUM" as const,
			currentPosition: 7,
			targetPosition: 3,
			targetUrl: "https://acmecorp.com/shipping",
			status: "RANKING" as const,
			notes: "Improve meta description CTR.",
		},
		{
			keyword: "custom widget manufacturer",
			monthlyVolume: 590,
			difficulty: 44,
			intent: "COMMERCIAL" as const,
			priority: "MEDIUM" as const,
			currentPosition: null,
			targetPosition: 10,
			targetUrl: "https://acmecorp.com/custom",
			status: "OPPORTUNITY" as const,
			notes: "Create dedicated landing page targeting B2B buyers.",
		},
		{
			keyword: "ecommerce seo strategy 2025",
			monthlyVolume: 1900,
			difficulty: 61,
			intent: "INFORMATIONAL" as const,
			priority: "MEDIUM" as const,
			currentPosition: 18,
			targetPosition: 10,
			targetUrl: "https://acmecorp.com/blog/ecommerce-seo-strategy",
			status: "TARGETING" as const,
			notes: "High competition. Build internal links from product pages.",
		},
		{
			keyword: "bulk widget order discount",
			monthlyVolume: 740,
			difficulty: 25,
			intent: "TRANSACTIONAL" as const,
			priority: "HIGH" as const,
			currentPosition: 6,
			targetPosition: 2,
			targetUrl: "https://acmecorp.com/bulk-orders",
			status: "RANKING" as const,
			notes: "Low difficulty + high intent. Priority quick win.",
		},
		{
			keyword: "widget installation guide",
			monthlyVolume: 1100,
			difficulty: 18,
			intent: "INFORMATIONAL" as const,
			priority: "LOW" as const,
			currentPosition: 4,
			targetPosition: 1,
			targetUrl: "https://acmecorp.com/guides/installation",
			status: "RANKING" as const,
			notes: "Earning featured snippet for most queries.",
		},
		{
			keyword: "eco friendly widget products",
			monthlyVolume: 680,
			difficulty: 30,
			intent: "COMMERCIAL" as const,
			priority: "MEDIUM" as const,
			currentPosition: null,
			targetPosition: 8,
			targetUrl: "https://acmecorp.com/eco",
			status: "OPPORTUNITY" as const,
			notes: "Growing trend. Add sustainability page.",
		},
		{
			keyword: "same day widget delivery sydney",
			monthlyVolume: 420,
			difficulty: 22,
			intent: "TRANSACTIONAL" as const,
			priority: "MEDIUM" as const,
			currentPosition: 9,
			targetPosition: 4,
			targetUrl: "https://acmecorp.com/same-day-delivery",
			status: "RANKING" as const,
			notes: "Local SEO opportunity. Add Sydney-specific content.",
		},
		{
			keyword: "acme corp review",
			monthlyVolume: 390,
			difficulty: 12,
			intent: "NAVIGATIONAL" as const,
			priority: "LOW" as const,
			currentPosition: 2,
			targetPosition: 1,
			targetUrl: "https://acmecorp.com/reviews",
			status: "WON" as const,
			notes: "Branded term. Protect position.",
		},
		{
			keyword: "product page optimisation",
			monthlyVolume: 2200,
			difficulty: 58,
			intent: "INFORMATIONAL" as const,
			priority: "LOW" as const,
			currentPosition: null,
			targetPosition: 15,
			targetUrl: "https://acmecorp.com/blog/product-page-optimisation",
			status: "OPPORTUNITY" as const,
			notes: "Authority content play — not primary revenue driver.",
		},
		{
			keyword: "online widget store australia",
			monthlyVolume: 1400,
			difficulty: 41,
			intent: "TRANSACTIONAL" as const,
			priority: "HIGH" as const,
			currentPosition: 8,
			targetPosition: 3,
			targetUrl: "https://acmecorp.com",
			status: "TARGETING" as const,
			notes: "Homepage target keyword. Improve E-E-A-T signals.",
		},
		{
			keyword: "widget warranty policy",
			monthlyVolume: 310,
			difficulty: 14,
			intent: "INFORMATIONAL" as const,
			priority: "LOW" as const,
			currentPosition: 1,
			targetPosition: 1,
			targetUrl: "https://acmecorp.com/warranty",
			status: "WON" as const,
			notes: "Top position. Monitor for featured snippet.",
		},
		{
			keyword: "b2b widget supply chain",
			monthlyVolume: 520,
			difficulty: 47,
			intent: "COMMERCIAL" as const,
			priority: "MEDIUM" as const,
			currentPosition: null,
			targetPosition: 8,
			targetUrl: "https://acmecorp.com/b2b",
			status: "OPPORTUNITY" as const,
			notes: "Emerging B2B opportunity. Develop dedicated landing page.",
		},
	];

	for (const kw of KEYWORDS) {
		await db
			.insert(keywordResearch)
			.values({
				clientId,
				createdBy: adminId,
				...kw,
			})
			.onConflictDoNothing();
	}

	console.log(`✅ Keyword research seeded (${KEYWORDS.length} keywords)`);
}

// ─── SEO Strategy ─────────────────────────────────────────────────────────────

async function seedStrategy(clientId: string, adminId: string) {
	const existing = await db
		.select()
		.from(seoStrategies)
		.where(eq(seoStrategies.clientId, clientId))
		.get();

	if (existing) {
		console.log("✅ SEO strategy already exists");
		return;
	}

	const sections = JSON.stringify([
		{
			id: "exec-summary",
			title: "Executive Summary",
			order: 1,
			content: `<p>This Q1 2025 SEO strategy targets a <strong>30% increase in organic sessions</strong> and a move from position 8 to position 4 for primary commercial keywords. Based on current metrics, Acme Corp has strong topical authority in widget supply and delivery, with an opportunity to expand into B2B and eco-friendly product verticals.</p><p>Priority areas: technical SEO fixes, content gap closure, and a focused backlink acquisition campaign targeting DR 50+ domains.</p>`,
		},
		{
			id: "keyword-targets",
			title: "Keyword Targets",
			order: 2,
			content: `<p>Primary targets (highest commercial value):</p><ul><li><strong>buy widgets online</strong> — 1,600/mo — currently #5, targeting #2</li><li><strong>affordable widget supplier</strong> — 880/mo — currently #12, targeting #5</li><li><strong>online widget store australia</strong> — 1,400/mo — currently #8, targeting #3</li></ul><p>Secondary targets (informational / brand authority):</p><ul><li>widget installation guide — 1,100/mo — targeting featured snippet</li><li>ecommerce seo strategy 2025 — 1,900/mo — brand authority play</li></ul>`,
		},
		{
			id: "technical-seo",
			title: "Technical SEO",
			order: 3,
			content: `<p>Audit findings and recommended fixes:</p><ol><li>Implement structured data (Product schema) on all product pages</li><li>Fix 14 broken internal links identified in crawl</li><li>Compress image assets — average page weight is 3.2MB (target: under 1.5MB)</li><li>Improve Core Web Vitals: LCP currently 4.1s, target under 2.5s</li><li>Add canonical tags to paginated collection pages</li></ol>`,
		},
		{
			id: "content-plan",
			title: "Content Plan",
			order: 4,
			content: `<p>Content deliverables for Q1 2025:</p><ul><li>3 x comparison articles (e.g. "Best widget suppliers in Australia 2025")</li><li>2 x buying guides ("How to choose the right widget for your business")</li><li>1 x eco-friendly product launch page</li><li>1 x B2B landing page targeting supply chain decision-makers</li><li>Update 5 existing blog posts with 2025 data and internal links</li></ul>`,
		},
		{
			id: "link-building",
			title: "Link Building",
			order: 5,
			content: `<p>Backlink targets for Q1:</p><ul><li>10 x guest posts on DR 40+ ecommerce and business blogs</li><li>3 x digital PR campaigns (product news, industry reports)</li><li>5 x competitor link reclamation (identified via Ahrefs)</li><li>Resource page outreach: target 8 relevant resource lists</li></ul><p>Current DR: 38. Target by end Q1: 44</p>`,
		},
		{
			id: "local-seo",
			title: "Local SEO",
			order: 6,
			content: `<p>Local SEO actions:</p><ul><li>Optimise Google Business Profile — add Q&A, photos, and posts</li><li>Build citations on 10 Australian business directories</li><li>Create "same day delivery [city]" landing pages for Sydney, Melbourne, Brisbane</li><li>Encourage reviews from recent customers via post-purchase email sequence</li></ul>`,
		},
		{
			id: "ai-visibility",
			title: "AI Visibility",
			order: 7,
			content: `<p>Strategy to improve AI search visibility (ChatGPT, Perplexity, Gemini):</p><ul><li>Ensure all product pages have clear, structured information (AI-readable)</li><li>Create FAQ sections for top queries</li><li>Publish authoritative brand statements and "About" content</li><li>Target Wikipedia/wikidata presence for brand entity recognition</li><li>Monitor brand mentions across AI platforms monthly via Rankscale</li></ul>`,
		},
		{
			id: "reporting",
			title: "Reporting & KPIs",
			order: 8,
			content: `<p>Key performance indicators:</p><table><tr><th>Metric</th><th>Current</th><th>Q1 Target</th></tr><tr><td>Organic Sessions/mo</td><td>~48,000</td><td>62,000</td></tr><tr><td>Domain Rating</td><td>38</td><td>44</td></tr><tr><td>Keywords in Top 10</td><td>24</td><td>38</td></tr><tr><td>AI Visibility Score</td><td>48</td><td>62</td></tr></table><p>Reports delivered monthly by the 5th business day.</p>`,
		},
		{
			id: "timeline",
			title: "Timeline",
			order: 9,
			content: `<p><strong>January:</strong> Technical audit implementation, content briefs, GMB optimisation.</p><p><strong>February:</strong> Publish 3 comparison articles, begin link building outreach, structured data rollout.</p><p><strong>March:</strong> B2B landing page live, 10 backlinks acquired, local landing pages, AI visibility review.</p><p>Monthly report and strategy review call on the first Tuesday of each month.</p>`,
		},
	]);

	await db.insert(seoStrategies).values({
		clientId,
		createdBy: adminId,
		title: "Q1 2025 SEO Strategy",
		sections,
		status: "PUBLISHED",
		publishedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
	});

	console.log("✅ SEO strategy seeded");
}

// ─── Monthly report (last month) ─────────────────────────────────────────────

async function seedReport(clientId: string, adminId: string) {
	const now = new Date();
	const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // last month
	const reportYear =
		now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

	const existing = await db
		.select()
		.from(monthlyReports)
		.where(eq(monthlyReports.clientId, clientId))
		.get();

	if (existing) {
		console.log("✅ Monthly report already exists");
		return;
	}

	const MONTH_NAMES = [
		"",
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	const monthLabel = `${MONTH_NAMES[reportMonth]} ${reportYear}`;

	const sections = JSON.stringify({
		executiveSummary: {
			adminNotes: `${monthLabel} was a strong month for Acme Corp. Organic sessions grew 18% month-over-month, driven by improved rankings across our primary commercial keywords. The campaign to target "buy widgets online" pushed us from position 7 to position 5, and we now rank in the top 10 for 26 target keywords (up from 21 last month).\n\nKey wins include a new DR 52 backlink from a major ecommerce publication and the successful launch of our B2B landing page which has already attracted 340 organic visits. Our AI visibility score improved from 48 to 57, indicating stronger brand recognition across ChatGPT and Perplexity.\n\nFocus for next month: push "affordable widget supplier" from #12 to the top 10, and publish two new comparison articles.`,
		},
		wins: {
			adminNotes: `• Organic sessions up 18% MoM — strongest month since launch\n• "buy widgets online" moved from #7 to #5\n• 26 keywords now in top 10 (was 21)\n• New DR 52 backlink acquired from industry publication\n• B2B landing page launched — 340 organic visits in first 2 weeks\n• AI Visibility Score improved: 48 → 57\n• Core Web Vitals — LCP improved from 4.1s to 3.4s after image compression`,
		},
		opportunities: {
			adminNotes: `• "affordable widget supplier" (#12) — 2-3 more backlinks should push to page 1. Low difficulty (28/100)\n• Eco-friendly product page needed — growing search trend with low competition\n• Local SEO: "same day delivery Sydney" is ranking at #9 — optimise further for local pack\n• 5 existing blog posts need internal link updates to pass authority to product pages\n• Schema markup still missing from 23 product pages — technical quick win`,
		},
		nextMonthGoals: {
			adminNotes: `1. Publish 2 x comparison articles ("Best Widget Suppliers Australia 2025", "Widget Delivery Speed Comparison")\n2. Push "affordable widget supplier" into top 10\n3. Complete structured data rollout on all product pages\n4. Launch eco-friendly product category page\n5. Acquire 4+ backlinks (targeting DR 40+ domains)\n6. Optimise 5 existing blog posts with updated internal links\n7. AI Visibility Score target: 62+`,
		},
	});

	await db.insert(monthlyReports).values({
		clientId,
		createdBy: adminId,
		month: reportMonth,
		year: reportYear,
		title: `${monthLabel} SEO Report`,
		sections,
		status: "PUBLISHED",
		publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // published 5 days ago
	});

	console.log(`✅ Monthly report seeded for ${monthLabel}`);
}

// ─── AI Visibility (last 6 months) ────────────────────────────────────────────

async function seedAIVisibility(clientId: string) {
	const now = new Date();
	const rows = [];

	// One record per month for the last 6 months
	for (let m = 5; m >= 0; m--) {
		const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
		const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

		const progress = (5 - m) / 5;
		const overallScore = parseFloat(
			(45 + progress * 20 + (Math.random() - 0.5) * 4).toFixed(1),
		);
		const rankscaleScore = parseFloat(
			(overallScore * randFloat(0.88, 1.02, 3)).toFixed(1),
		);
		const secondaryScore = Math.round(overallScore * randFloat(0.85, 1.15, 0));
		const totalPrompts = 5;
		const promptsVisible = Math.round(totalPrompts * (overallScore / 100));

		rows.push({
			clientId,
			date: dateString,
			overallScore,
			rankscaleScore,
			secondaryScore,
			totalPromptsTested: totalPrompts,
			promptsVisible,
			notes: `Monthly AI visibility snapshot — ${dateString}`,
		});
	}

	for (const row of rows) {
		await db.insert(aiVisibility).values(row).onConflictDoNothing();
	}

	console.log(`✅ AI visibility data seeded (${rows.length} monthly records)`);
}

// ─── Rankscale prompt metrics ──────────────────────────────────────────────────

async function seedRankscale(clientId: string) {
	const PROMPTS = [
		"What is the best place to buy widgets online in Australia?",
		"Recommend a reliable widget supplier for small businesses",
		"Where can I order bulk widgets with fast delivery?",
		"What are the top ecommerce stores for industrial widgets?",
		"Best widget brands in Australia 2025",
	];

	const PLATFORMS = ["ChatGPT", "Perplexity"];
	const rows = [];
	const now = new Date();

	for (let m = 5; m >= 0; m--) {
		const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
		const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
		const visibility = 0.4 + (5 - m) * 0.08; // grows from 40% to 80%

		for (const prompt of PROMPTS) {
			for (const platform of PLATFORMS) {
				const isVisible = Math.random() < visibility;
				const position = isVisible ? rand(1, 5) : null;
				const visibilityScore = isVisible
					? parseFloat((60 + Math.random() * 35).toFixed(1))
					: parseFloat((Math.random() * 30).toFixed(1));

				rows.push({
					clientId,
					date,
					prompt,
					platform,
					isVisible,
					position,
					responseSnippet: isVisible
						? `Acme Corp is frequently recommended for ${prompt.toLowerCase().includes("bulk") ? "bulk orders" : "quality and fast delivery"}.`
						: null,
					visibilityScore,
				});
			}
		}
	}

	for (const row of rows) {
		await db.insert(rankscaleMetrics).values(row).onConflictDoNothing();
	}

	console.log(`✅ Rankscale metrics seeded (${rows.length} prompt records)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── API Credentials (agency-level demo) ────────────────────────────────────

async function seedApiCredentials() {
	const providers = [
		{
			provider: "MOZ" as const,
			credentialsEnc: encrypt(
				JSON.stringify({
					accessId: "demo-access-id",
					secretKey: "demo-secret-key",
				}),
			),
			label: "Demo Moz credentials",
		},
		{
			provider: "DATAFORSEO" as const,
			credentialsEnc: encrypt(
				JSON.stringify({
					login: "demo@example.com",
					password: "demo-password",
				}),
			),
			label: "Demo DataForSEO credentials",
		},
		{
			provider: "RANKSCALE" as const,
			credentialsEnc: encrypt(JSON.stringify({ apiKey: "demo-rankscale-key" })),
			label: "Demo Rankscale credentials",
		},
	];

	for (const cred of providers) {
		await db.insert(apiCredentials).values(cred).onConflictDoNothing();
	}

	console.log(`✅ API credentials seeded (${providers.length} providers)`);
}

// ─── Data Sources (per-client) ──────────────────────────────────────────────

async function seedDataSources(clientId: string) {
	const sourceTypes = ["GA4", "GSC", "MOZ", "DATAFORSEO", "RANKSCALE"] as const;

	for (const type of sourceTypes) {
		await db
			.insert(dataSources)
			.values({
				clientId,
				type,
				isConnected: true,
				propertyIdentifier:
					type === "GA4"
						? "properties/123456789"
						: type === "GSC"
							? "https://acmecorp.com/"
							: null,
			})
			.onConflictDoNothing();
	}

	console.log(`✅ Data sources seeded (${sourceTypes.length} sources)`);
}

// ─── Sync Jobs (demo history) ───────────────────────────────────────────────

async function seedSyncJobs(clientId: string) {
	const sourceTypes = ["GA4", "GSC", "MOZ", "DATAFORSEO", "RANKSCALE"] as const;
	const jobs = [];

	// Create 3 successful syncs per source over the last 7 days
	for (const source of sourceTypes) {
		for (let i = 0; i < 3; i++) {
			const daysAgo = i * 2 + 1; // 1, 3, 5 days ago
			const createdAt = new Date();
			createdAt.setDate(createdAt.getDate() - daysAgo);
			const startedAt = new Date(createdAt.getTime() + 1000);
			const completedAt = new Date(startedAt.getTime() + rand(5000, 30000));

			jobs.push({
				clientId,
				source,
				status: "SUCCESS" as const,
				startedAt,
				completedAt,
				rowsInserted: rand(10, 150),
				error: null,
				triggeredBy: "MANUAL" as const,
				retryCount: 0,
				createdAt,
			});
		}
	}

	// Add 1 failed job for MOZ (most recent)
	const failedAt = new Date();
	jobs.push({
		clientId,
		source: "MOZ" as const,
		status: "FAILED" as const,
		startedAt: failedAt,
		completedAt: new Date(failedAt.getTime() + 5000),
		rowsInserted: 0,
		error: "API rate limit exceeded",
		triggeredBy: "MANUAL" as const,
		retryCount: 1,
		createdAt: failedAt,
	});

	for (const job of jobs) {
		await db.insert(syncJobs).values(job);
	}

	console.log(`✅ Sync jobs seeded (${jobs.length} jobs)`);
}

async function seed() {
	console.log("\n🌱 Seeding database...\n");

	const admin = await seedAdmin();
	const client = await seedDemoClient(admin.id);
	await seedClientUser(client.id);

	await seedApiCredentials();
	await seedDataSources(client.id);
	await seedSyncJobs(client.id);
	await seedGA4(client.id);
	await seedGSC(client.id);
	await seedMoz(client.id);
	await seedKeywords(client.id, admin.id);
	await seedStrategy(client.id, admin.id);
	await seedReport(client.id, admin.id);
	await seedAIVisibility(client.id);
	await seedRankscale(client.id);

	// Seed RBAC & Approvals
	await seedRoles();
	await seedApprovalPolicies();
	await seedDefaultKanbanColumns(client.id);

	console.log("\n✅ Seed complete!\n");
	console.log("  Admin:  admin@bitbrandanarchy.com / admin123!");
	console.log("  Client: client@acmecorp.com / client123!");
	console.log("  Portal: /portal/acme-corp/dashboard\n");
}

// ─── RBAC & Approvals ────────────────────────────────────────────────────────

async function seedRoles() {
	const defaultRoles = [
		{
			name: "MARKETING_LEAD",
			description: "Marketing team lead with approval authority",
			permissions: JSON.stringify([
				"approve_reports",
				"approve_strategies",
				"manage_tasks",
			]),
			isSystem: true,
		},
		{
			name: "SEO_SPECIALIST",
			description: "SEO specialist with content creation rights",
			permissions: JSON.stringify([
				"create_reports",
				"create_strategies",
				"manage_keywords",
			]),
			isSystem: true,
		},
		{
			name: "CONTENT_WRITER",
			description: "Content writer with limited permissions",
			permissions: JSON.stringify(["create_drafts", "view_reports"]),
			isSystem: true,
		},
	];

	for (const role of defaultRoles) {
		const existing = await db
			.select()
			.from(roles)
			.where(eq(roles.name, role.name))
			.get();

		if (!existing) {
			await db.insert(roles).values(role);
			console.log(`✅ Created role: ${role.name}`);
		}
	}
}

async function seedApprovalPolicies() {
	const defaultPolicies = [
		{
			name: "report_publish",
			description: "Approval required to publish monthly reports",
			resourceType: "REPORT",
			action: "PUBLISH",
			requiredRoles: JSON.stringify(["MARKETING_LEAD", "ADMIN"]),
			isActive: true,
		},
		{
			name: "strategy_publish",
			description: "Approval required to publish SEO strategies",
			resourceType: "STRATEGY",
			action: "PUBLISH",
			requiredRoles: JSON.stringify(["MARKETING_LEAD", "ADMIN"]),
			isActive: true,
		},
	];

	for (const policy of defaultPolicies) {
		const existing = await db
			.select()
			.from(approvalPolicies)
			.where(eq(approvalPolicies.name, policy.name))
			.get();

		if (!existing) {
			await db.insert(approvalPolicies).values(policy);
			console.log(`✅ Created approval policy: ${policy.name}`);
		}
	}
}

async function seedDefaultKanbanColumns(clientId: string) {
	const defaultColumns = [
		{ name: "Backlog", position: 0, color: "#94a3b8", isDefault: true },
		{ name: "To Do", position: 1, color: "#60a5fa", isDefault: false },
		{ name: "In Progress", position: 2, color: "#fbbf24", isDefault: false },
		{ name: "Review", position: 3, color: "#a78bfa", isDefault: false },
		{ name: "Done", position: 4, color: "#34d399", isDefault: false },
	];

	const existing = await db
		.select()
		.from(kanbanColumns)
		.where(eq(kanbanColumns.clientId, clientId))
		.all();

	if (existing.length === 0) {
		for (const col of defaultColumns) {
			await db.insert(kanbanColumns).values({
				clientId,
				...col,
			});
		}
		console.log(`✅ Created default kanban columns for client`);
	}
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
