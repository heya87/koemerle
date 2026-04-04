import type { KeyNormalizer } from './ingredients.js';

export type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type Slot = 'lunch' | 'dinner';

export interface PlanRecipe {
	id: number;
	name: string;
	matchKeys: string[];
	recipeUrl?: string | null;
}

export interface PlanEntry {
	day: Day;
	slot: Slot;
	recipeId: number | null;
	notNeeded: boolean;
}

export const ALL_SLOTS: [Day, Slot][] = [
	['monday', 'lunch'],
	['monday', 'dinner'],
	['tuesday', 'lunch'],
	['tuesday', 'dinner'],
	['wednesday', 'lunch'],
	['wednesday', 'dinner'],
	['thursday', 'lunch'],
	['thursday', 'dinner'],
	['friday', 'lunch'],
	['friday', 'dinner'],
	['saturday', 'lunch'],
	['saturday', 'dinner'],
	['sunday', 'lunch'],
	['sunday', 'dinner']
];

/**
 * Suggests a meal plan for a set of slots.
 *
 * - Recipes are scored by how many basket ingredients they match.
 * - Coverage-first: each slot prefers recipes that cover basket ingredients
 *   not yet covered by earlier slots in this run.
 * - Recipes in `usedIds` (pre-existing entries) are excluded.
 * - Slots in `occupiedSlotKeys` ("day-slot") are skipped (left as-is).
 * - Slots in `notNeededSlotKeys` get a null recipeId with notNeeded=true.
 */
export function suggestPlan(params: {
	allRecipes: PlanRecipe[];
	basketKeys: Set<string>;
	usedIds: Set<number>;
	occupiedSlotKeys: Set<string>;
	notNeededSlotKeys: Set<string>;
	slots: [Day, Slot][];
	normalize: KeyNormalizer;
}): PlanEntry[] {
	const { allRecipes, basketKeys, usedIds, occupiedSlotKeys, notNeededSlotKeys, slots, normalize } =
		params;

	const scored = allRecipes
		.map((r) => ({
			...r,
			score: r.matchKeys.filter((k) => basketKeys.has(normalize(k))).length
		}))
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

	const available = scored.filter((r) => !usedIds.has(r.id));
	const coveredKeys = new Set<string>();
	const result: PlanEntry[] = [];

	for (const [day, slot] of slots) {
		const slotKey = `${day}-${slot}`;

		if (notNeededSlotKeys.has(slotKey)) {
			result.push({ day, slot, recipeId: null, notNeeded: true });
			continue;
		}

		if (occupiedSlotKeys.has(slotKey)) continue;

		available.sort((a, b) => {
			const newA = a.matchKeys.filter(
				(k) => basketKeys.has(normalize(k)) && !coveredKeys.has(normalize(k))
			).length;
			const newB = b.matchKeys.filter(
				(k) => basketKeys.has(normalize(k)) && !coveredKeys.has(normalize(k))
			).length;
			return newB - newA || b.score - a.score || a.name.localeCompare(b.name);
		});

		const recipe = available.shift();
		if (!recipe) continue;

		usedIds.add(recipe.id);
		for (const k of recipe.matchKeys) {
			if (basketKeys.has(normalize(k))) coveredKeys.add(normalize(k));
		}
		result.push({ day, slot, recipeId: recipe.id, notNeeded: false });
	}

	return result;
}
