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
	const { BRING_LIST_ID, BRING_LIST_NAME, BRING_LIST_ID_2, BRING_LIST_NAME_2 } = env;
	const bringLists =
		BRING_LIST_ID && BRING_LIST_ID_2
			? [
					{ id: BRING_LIST_ID, name: BRING_LIST_NAME || 'Liste 1' },
					{ id: BRING_LIST_ID_2, name: BRING_LIST_NAME_2 || 'Liste 2' }
				]
			: [];
	return { weekStart, shoppingList, bringLists };
};

export const actions: Actions = {
	sendToBring: async ({ locals, request }) => {
		if (!locals.user) return fail(401);

		const { BRING_EMAIL, BRING_PASSWORD, BRING_LIST_ID } = env;
		if (!BRING_EMAIL || !BRING_PASSWORD) {
			return fail(400, { message: 'Bring! Zugangsdaten fehlen (BRING_EMAIL / BRING_PASSWORD).' });
		}
		if (!BRING_LIST_ID) {
			return fail(400, { message: 'BRING_LIST_ID fehlt in den Umgebungsvariablen.' });
		}

		const formData = await request.formData();
		const assignmentsJson = formData.get('assignments') as string | null;
		const assignments: Record<string, string> = assignmentsJson ? JSON.parse(assignmentsJson) : {};

		const { shoppingList } = await loadShoppingData();

		if (shoppingList.length === 0) {
			return { sent: 0 };
		}

		// Group items by target list
		const byList: Record<string, string[]> = {};
		for (const item of shoppingList) {
			const listId = assignments[item.displayText] ?? BRING_LIST_ID;
			if (!byList[listId]) byList[listId] = [];
			byList[listId].push(item.displayText);
		}

		try {
			const bring = new BringApi({ mail: BRING_EMAIL, password: BRING_PASSWORD });
			await bring.login();

			let sent = 0;
			for (const [listId, items] of Object.entries(byList)) {
				const existing = await bring.getItems(listId);
				const existingNames = new Set(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(existing.purchase ?? []).map((i: any) => i.name?.toLowerCase().trim())
				);
				for (const itemName of items) {
					if (!existingNames.has(itemName.toLowerCase().trim())) {
						await bring.saveItem(listId, itemName, '');
						sent++;
					}
				}
			}

			return { sent };
		} catch (e) {
			console.error('Bring! error:', e);
			return fail(500, { message: 'Fehler beim Senden an Bring!.' });
		}
	}
};
