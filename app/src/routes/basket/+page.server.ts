import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { basketItems } from '$lib/server/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getWeekStart, generateBasketMatchKey } from '$lib/server/ingredients';
import { fetchCurrentBasket } from '$lib/server/bioabo';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();
	const items = await db
		.select()
		.from(basketItems)
		.where(eq(basketItems.weekStart, weekStart))
		.orderBy(basketItems.id);

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

		// Delete only previously imported items for this delivery (leave manually added items alone)
		if (deliveryDate) {
			await db.delete(basketItems).where(
				and(eq(basketItems.weekStart, weekStart), eq(basketItems.deliveryDate, deliveryDate))
			);
		} else {
			// No delivery date — fall back to replacing all imported items
			await db.delete(basketItems).where(
				and(eq(basketItems.weekStart, weekStart), isNotNull(basketItems.deliveryDate))
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
