import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { basketItems } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWeekStart, generateBasketMatchKey, mergeBasketItems } from '$lib/server/ingredients';
import { fetchCurrentBasket } from '$lib/server/bioabo';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();
	const items = await db
		.select()
		.from(basketItems)
		.where(eq(basketItems.weekStart, weekStart))
		.orderBy(basketItems.id);

	const bioaboConfigured = !!(env.BIOABO_EMAIL && env.BIOABO_PASSWORD);
	return { weekStart, items, bioaboConfigured };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const displayText = formData.get('displayText')?.toString().trim() ?? '';

		if (!displayText) return fail(400, { message: 'Bitte einen Eintrag eingeben.' });

		const weekStart = getWeekStart();
		const matchKey = generateBasketMatchKey(displayText);

		// Merge with existing item of the same ingredient if possible
		const [existing] = await db
			.select()
			.from(basketItems)
			.where(and(eq(basketItems.weekStart, weekStart), eq(basketItems.matchKey, matchKey)));

		if (existing) {
			const merged = mergeBasketItems(existing.displayText, displayText);
			if (merged) {
				await db
					.update(basketItems)
					.set({ displayText: merged })
					.where(eq(basketItems.id, existing.id));
				return;
			}
		}

		await db.insert(basketItems).values({ weekStart, displayText, matchKey });
	},

	updateKey: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const matchKey = formData.get('matchKey')?.toString().trim().toLowerCase() ?? '';
		if (!matchKey) return fail(400, { message: 'Schlüssel darf nicht leer sein.' });
		const weekStart = getWeekStart();
		await db.update(basketItems).set({ matchKey }).where(
			and(eq(basketItems.id, id), eq(basketItems.weekStart, weekStart))
		);
	},

	remove: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const weekStart = getWeekStart();

		await db.delete(basketItems).where(
			and(eq(basketItems.id, id), eq(basketItems.weekStart, weekStart))
		);
	},

	sync: async ({ locals }) => {
		if (!locals.user) return fail(401);

		let synced: Awaited<ReturnType<typeof fetchCurrentBasket>>;
		try {
			synced = await fetchCurrentBasket();
		} catch (e) {
			return fail(500, { message: `Sync fehlgeschlagen: ${String(e)}` });
		}

		if (synced.length === 0) {
			return fail(400, { message: 'Keine Lieferung gefunden oder Korb ist leer.' });
		}

		const weekStart = getWeekStart();

		// Replace existing basket for this week
		await db.delete(basketItems).where(eq(basketItems.weekStart, weekStart));

		for (const item of synced) {
			const qty = Number.isInteger(item.amount) ? String(item.amount) : item.amount.toFixed(1);
			const displayText = `${qty} ${item.unit} ${item.name}`;
			const matchKey = item.matchKey ?? generateBasketMatchKey(displayText);
			await db.insert(basketItems).values({ weekStart, displayText, matchKey });
		}

		return { synced: synced.length };
	}
};
