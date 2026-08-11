import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { mealPlanEntries, recipes } from '$lib/server/db/schema';
import { eq, and, gte } from 'drizzle-orm';

const NOT_NEEDED = '__not_needed__';

function slotOrder(slot: string): number {
	return slot === 'lunch' ? 0 : 1;
}

export const load: PageServerLoad = async ({ locals }) => {
	const familyId = locals.user!.familyId;
	const today = new Date().toISOString().split('T')[0];

	const [entries, allRecipes] = await Promise.all([
		db.select().from(mealPlanEntries).where(and(eq(mealPlanEntries.familyId, familyId), gte(mealPlanEntries.date, today))),
		db.select().from(recipes).where(eq(recipes.familyId, familyId))
	]);

	const recipeById = new Map(allRecipes.map((r) => [r.id, r]));

	const meals = entries
		.filter((e) => e.course === 'main' && e.freeText !== NOT_NEEDED && (e.recipeId || e.freeText))
		.map((e) => {
			const recipe = e.recipeId ? (recipeById.get(e.recipeId) ?? null) : null;
			return {
				date: e.date,
				slot: e.slot,
				name: recipe?.name ?? e.freeText ?? '—',
				recipe
			};
		})
		.sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot));

	return { today, meals };
};
