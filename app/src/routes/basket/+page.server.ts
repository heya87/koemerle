import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { basketItems } from '$lib/server/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { getWeekStart, generateBasketMatchKey } from '$lib/server/ingredients';
import { fetchCurrentBasket } from '$lib/server/bioabo';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();
	const items = await db
		.select()
		.from(basketItems)
		.where(eq(basketItems.weekStart, weekStart))
		.orderBy(sql`${basketItems.deliveryDate} ASC NULLS LAST`, basketItems.id);

	const deliveryDate = items.find((i) => i.deliveryDate !== null)?.deliveryDate ?? null;

	const bioaboConfigured = !!(env.BIOABO_EMAIL && env.BIOABO_PASSWORD);
	return { weekStart, items, deliveryDate, bioaboConfigured };
};

export const actions: Actions = {
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

	updateDisplay: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const displayText = formData.get('displayText')?.toString().trim() ?? '';
		if (!displayText) return fail(400, { message: 'Bezeichnung darf nicht leer sein.' });
		const weekStart = getWeekStart();
		await db.update(basketItems).set({ displayText }).where(
			and(eq(basketItems.id, id), eq(basketItems.weekStart, weekStart))
		);
	},

	add: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const displayText = formData.get('displayText')?.toString().trim() ?? '';
		if (!displayText) return fail(400, { message: 'Bitte einen Eintrag eingeben.' });
		const weekStart = getWeekStart();
		const matchKey = generateBasketMatchKey(displayText);

		// Inherit this week's known delivery date (if any) so manually added items are
		// gated the same as synced ones instead of being usable for the whole week.
		const [known] = await db
			.select({ deliveryDate: basketItems.deliveryDate })
			.from(basketItems)
			.where(and(eq(basketItems.weekStart, weekStart), isNotNull(basketItems.deliveryDate)))
			.limit(1);

		await db.insert(basketItems).values({
			weekStart,
			displayText,
			matchKey,
			deliveryDate: known?.deliveryDate ?? null,
			manual: true
		});
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

		let result: Awaited<ReturnType<typeof fetchCurrentBasket>>;
		try {
			result = await fetchCurrentBasket();
		} catch (e) {
			return fail(500, { message: `Sync fehlgeschlagen: ${String(e)}` });
		}

		const { items, deliveryDate } = result;

		if (items.length === 0) {
			return fail(400, { message: 'Keine Lieferung gefunden oder Korb ist leer.' });
		}

		const weekStart = getWeekStart();

		// Delete only previously imported items for this delivery (leave manually added items alone —
		// they can now carry the same deliveryDate, so the manual flag is what protects them here).
		if (deliveryDate) {
			await db.delete(basketItems).where(
				and(eq(basketItems.weekStart, weekStart), eq(basketItems.deliveryDate, deliveryDate), eq(basketItems.manual, false))
			);
		} else {
			// No delivery date — fall back to replacing all imported items
			await db.delete(basketItems).where(
				and(eq(basketItems.weekStart, weekStart), isNotNull(basketItems.deliveryDate), eq(basketItems.manual, false))
			);
		}

		for (const item of items) {
			const qty = Number.isInteger(item.amount) ? String(item.amount) : item.amount.toFixed(1);
			const displayText = `${qty} ${item.unit} ${item.name}`;
			const matchKey = item.matchKey ?? generateBasketMatchKey(displayText);
			await db.insert(basketItems).values({ weekStart, displayText, matchKey, deliveryDate });
		}

		return { synced: items.length };
	}
};
