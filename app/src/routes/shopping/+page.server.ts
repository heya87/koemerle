import { fail } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems, mealPlanEntries, ingredientGroups } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getWeekStart, buildAliasMap, createKeyNormalizer } from '$lib/server/ingredients';
import { computeShoppingList } from '$lib/server/shopping';
import { env } from '$env/dynamic/private';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BringApi = createRequire(import.meta.url)('bring-shopping') as any;

async function loadShoppingData() {
	const weekStart = getWeekStart();

	const [entries, basket, groups] = await Promise.all([
		db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart)),
		db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
		db.select().from(ingredientGroups)
	]);

	const recipeIds = entries.map((e) => e.recipeId).filter((id): id is number => id !== null);
	const [plannedRecipes, allRecipes] = await Promise.all([
		recipeIds.length > 0 ? db.select().from(recipes).where(inArray(recipes.id, recipeIds)) : Promise.resolve([]),
		db.select({ name: recipes.name, ingredients: recipes.ingredients }).from(recipes)
	]);

	const normalize = createKeyNormalizer(buildAliasMap(groups));
	const basketKeys = basket.map((b) => b.matchKey);
	const shoppingList = computeShoppingList(
		plannedRecipes.map((r) => r.ingredients),
		basketKeys,
		allRecipes,
		normalize
	);

	return { weekStart, shoppingList };
}

export const load: PageServerLoad = async () => {
	const { weekStart, shoppingList } = await loadShoppingData();
	return { weekStart, shoppingList };
};

export const actions: Actions = {
	sendToBring: async ({ locals }) => {
		if (!locals.user) return fail(401);

		const { BRING_EMAIL, BRING_PASSWORD, BRING_LIST_ID } = env;
		if (!BRING_EMAIL || !BRING_PASSWORD) {
			return fail(400, { message: 'Bring! Zugangsdaten fehlen (BRING_EMAIL / BRING_PASSWORD).' });
		}

		const { shoppingList } = await loadShoppingData();

		if (shoppingList.length === 0) {
			return { sent: 0 };
		}

		try {
			const bring = new BringApi({ mail: BRING_EMAIL, password: BRING_PASSWORD });
			await bring.login();

			let listId = BRING_LIST_ID;
			if (!listId) {
				const { lists } = await bring.loadLists();
				listId = lists?.[0]?.listUuid;
				if (!listId) return fail(500, { message: 'Keine Bring!-Liste gefunden.' });
			}

			// Get existing items to avoid duplicates
			const existing = await bring.getItems(listId);
			const existingNames = new Set(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(existing.purchase ?? []).map((i: any) => i.name?.toLowerCase().trim())
			);

			const toAdd = shoppingList.filter(
				(item) => !existingNames.has(item.displayText.toLowerCase().trim())
			);

			for (const item of toAdd) {
				await bring.saveItem(listId, item.displayText, '');
			}

			return { sent: toAdd.length };
		} catch (e) {
			console.error('Bring! error:', e);
			return fail(500, { message: 'Fehler beim Senden an Bring!.' });
		}
	}
};
