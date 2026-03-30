import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { basketItems } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWeekStart, generateBasketMatchKey, mergeBasketItems } from '$lib/server/ingredients';

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();
	const items = await db
		.select()
		.from(basketItems)
		.where(eq(basketItems.weekStart, weekStart))
		.orderBy(basketItems.id);

	return { weekStart, items };
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

	remove: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const weekStart = getWeekStart();

		await db.delete(basketItems).where(
			and(eq(basketItems.id, id), eq(basketItems.weekStart, weekStart))
		);
	}
};
