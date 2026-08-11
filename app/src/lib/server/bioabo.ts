import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { basketItems, cronRuns } from '$lib/server/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getWeekStart, generateBasketMatchKey } from '$lib/server/ingredients';
import { getAllFamilies, getFamilyBioaboConfig } from '$lib/server/families';

export type BasketItem = {
	name: string;
	amount: number;
	unit: string;
	matchKey?: string; // pre-computed from alias when available
};

// Alias segments to skip when deriving a match key (colour/variety descriptors that precede the ingredient name)
const ALIAS_DESCRIPTORS = new Set(['golden', 'farbige', 'farbig', 'farbigen']);

/** Derives a match key from a product alias slug (e.g. "kuerbis-kabucho" → "kürbis", "golden-Randen" → "randen"). */
function aliasToMatchKey(alias: string): string {
	const segments = alias.toLowerCase().split('-');
	const segment =
		segments.find((s) => s.length >= 3 && !ALIAS_DESCRIPTORS.has(s) && !/^\d/.test(s)) ??
		segments[0];
	return segment.replace(/ue/g, 'ü').replace(/ae/g, 'ä').replace(/oe/g, 'ö');
}

// Login tokens are per Biogmüsabo account, so cache by email — different families use
// different accounts.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function login(email: string, password: string): Promise<string> {
	const cached = tokenCache.get(email);
	if (cached && Date.now() < cached.expiresAt) return cached.token;

	const res = await fetch('https://biogmuesabo.ch/ACM/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username: email, password, authInfo: null, systemModuleSid: 18 })
	});
	if (!res.ok) throw new Error(`Biogmüsabo login failed: ${res.status}`);

	const data = await res.json();
	if (!data.token) throw new Error('No token in login response');

	tokenCache.set(email, { token: data.token as string, expiresAt: Date.now() + TOKEN_TTL_MS });
	return data.token as string;
}

export async function fetchCurrentBasket(email: string, password: string): Promise<{ items: BasketItem[]; deliveryDate: string | null }> {
	const token = await login(email, password);

	const res = await fetch('https://biogmuesabo.ch/ACM/api/webshop/getcurrentdeliveries', {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error(`Fetch deliveries failed: ${res.status}`);

	const deliveries = (await res.json()) as any[];
	const next = deliveries[0];
	if (!next) return { items: [], deliveryDate: null };

	// Extract delivery date — try common field names
	const rawDate = next.date ?? next.deliveryDate ?? next.deliveryDay ?? null;
	let deliveryDate: string | null = null;
	if (rawDate) {
		const parsed = new Date(rawDate);
		if (!isNaN(parsed.getTime())) {
			deliveryDate = parsed.toISOString().split('T')[0];
		}
	}

	const items: BasketItem[] = [];

	for (const pos of next.deliveryPositions ?? []) {
		const contentDescPos = pos.productDetail?.contentDescPos;

		if (contentDescPos?.length > 0) {
			// Bundle product (e.g. veggie bag) — use the individual sub-items
			// Sub-item aliases often start with a colour/variety descriptor, so use name-based key derivation
			for (const sub of contentDescPos) {
				if (sub.stateSid !== 10) continue;
				const alias = sub.productDetail?.alias as string | undefined;
				items.push({
					name: sub.productDetail.name,
					amount: sub.amount,
					unit: sub.productDetail.unit,
					matchKey: alias ? aliasToMatchKey(alias) : undefined
				});
			}
		} else {
			// Direct product (e.g. eggs, whole pumpkin) — alias first segment is the reliable ingredient name
			if (pos.stateSid !== 10) continue;
			const alias = pos.productDetail?.alias as string | undefined;
			items.push({
				name: pos.productDetail.name,
				amount: pos.amountAdmin,
				unit: pos.productDetail.unit,
				matchKey: alias ? aliasToMatchKey(alias) : undefined
			});
		}
	}

	return { items, deliveryDate };
}

async function syncFamilyBasket(familyId: number, email: string, password: string): Promise<void> {
	const job = 'basket-sync';

	try {
		const { items, deliveryDate } = await fetchCurrentBasket(email, password);

		if (items.length === 0) {
			await db.insert(cronRuns).values({ familyId, job, success: true, outcome: 'no_delivery', detail: null });
			return;
		}

		const weekStart = getWeekStart();

		// Always delete previously imported items and re-import fresh.
		// Manually added items (manual = true) are never touched, even if they now
		// share the same deliveryDate as synced items.
		if (deliveryDate) {
			await db.delete(basketItems).where(
				and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart), eq(basketItems.deliveryDate, deliveryDate), eq(basketItems.manual, false))
			);
		} else {
			await db.delete(basketItems).where(
				and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart), isNotNull(basketItems.deliveryDate), eq(basketItems.manual, false))
			);
		}

		for (const item of items) {
			const qty = Number.isInteger(item.amount) ? String(item.amount) : item.amount.toFixed(1);
			const displayText = `${qty} ${item.unit} ${item.name}`;
			const matchKey = item.matchKey ?? generateBasketMatchKey(displayText);
			await db.insert(basketItems).values({ familyId, weekStart, displayText, matchKey, deliveryDate });
		}

		await db.insert(cronRuns).values({
			familyId,
			job,
			success: true,
			outcome: 'imported',
			detail: `${items.length} Artikel, Lieferung ${deliveryDate ?? 'unbekannt'}`
		});
	} catch (e) {
		await db.insert(cronRuns).values({ familyId, job, success: false, outcome: 'error', detail: String(e) });
	}
}

/** Runs the Biogmüsabo sync for every family that has it configured (own credentials or, for family 1, the legacy env vars). */
export async function autoSyncBasket(): Promise<void> {
	const allFamilies = await getAllFamilies();

	for (const family of allFamilies) {
		const config = await getFamilyBioaboConfig(family, { email: env.BIOABO_EMAIL, password: env.BIOABO_PASSWORD });
		if (!config) continue;
		await syncFamilyBasket(family.id, config.email, config.password);
	}
}

