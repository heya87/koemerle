import type { KeyNormalizer } from './ingredients.js';

export type Slot = 'lunch' | 'dinner';
export type Course = 'main' | 'side';

export interface PlanRecipe {
	id: number;
	name: string;
	matchKeys: string[];
	recipeUrl?: string | null;
	course: string | null; // 'main' | 'side' | null (null = fits either course)
}

export interface PlanEntry {
	date: string; // YYYY-MM-DD
	slot: Slot;
	course: Course;
	recipeId: number | null;
	notNeeded: boolean;
}

/**
 * Generates [date, slot] pairs for a planning period.
 * If startSlot is 'dinner', the first day only gets dinner (lunch is skipped).
 */
export function generateSlots(startDate: string, endDate: string, startSlot: Slot = 'lunch'): [string, Slot][] {
	const slots: [string, Slot][] = [];
	const end = new Date(endDate + 'T12:00:00Z');
	const current = new Date(startDate + 'T12:00:00Z');
	let isFirst = true;

	while (current <= end) {
		const d = current.toISOString().split('T')[0];
		if (isFirst) {
			if (startSlot === 'dinner') {
				slots.push([d, 'dinner']);
			} else {
				slots.push([d, 'lunch']);
				slots.push([d, 'dinner']);
			}
			isFirst = false;
		} else {
			slots.push([d, 'lunch']);
			slots.push([d, 'dinner']);
		}
		current.setUTCDate(current.getUTCDate() + 1);
	}
	return slots;
}

/**
 * Suggests a meal plan for a set of slots, filling main and side courses separately.
 *
 * Pass 1 — main courses:
 *   Uses recipes with course = null or 'main'. Coverage-first: prefers recipes
 *   that cover basket ingredients not yet covered by earlier slots.
 *
 * Pass 2 — side courses:
 *   Only runs if basket keys remain uncovered after pass 1.
 *   Uses recipes with course = null or 'side' that match at least one uncovered key.
 *   Coverage-first within uncovered keys.
 *
 * - Recipes in `usedIds` are excluded from both passes.
 * - Slots in `occupiedKeys` ("date-slot-course") are skipped.
 * - Slots in `notNeededSlotKeys` ("date-slot") get course='main', notNeeded=true; side is skipped.
 * - basketItems with deliveryDate are only available for slots on/after that date.
 * - fridgeItems are always available but do not drive the coverage-first scoring.
 */
export function suggestPlan(params: {
	allRecipes: PlanRecipe[];
	basketItems: { matchKey: string; deliveryDate: string | null }[];
	usedIds: Set<number>;
	occupiedKeys: Set<string>;
	notNeededSlotKeys: Set<string>;
	slots: [string, Slot][]; // [date, slot]
	normalize: KeyNormalizer;
}): PlanEntry[] {
	const { allRecipes, basketItems, usedIds, occupiedKeys, notNeededSlotKeys, slots, normalize } = params;

	const allBasketKeys = new Set(basketItems.map((i) => normalize(i.matchKey)));

	function getSlotBasketKeys(slotDate: string): Set<string> {
		return new Set(
			basketItems
				.filter((i) => i.deliveryDate === null || i.deliveryDate <= slotDate)
				.map((i) => normalize(i.matchKey))
		);
	}

	const result: PlanEntry[] = [];
	const coveredKeys = new Set<string>();

	// ── Pass 1: main courses ──
	const mainEligible = allRecipes.filter((r) => r.course === null || r.course === 'main');

	for (const [date, slot] of slots) {
		const slotKey = `${date}-${slot}`;

		if (notNeededSlotKeys.has(slotKey)) {
			result.push({ date, slot, course: 'main', recipeId: null, notNeeded: true });
			continue;
		}

		if (occupiedKeys.has(`${slotKey}-main`)) continue;

		const slotBasketKeys = getSlotBasketKeys(date);

		const available = mainEligible
			.filter((r) => !usedIds.has(r.id))
			.filter((r) => r.matchKeys.some((k) => slotBasketKeys.has(normalize(k))))
			.map((r) => ({
				...r,
				newCoverage: r.matchKeys.filter((k) => slotBasketKeys.has(normalize(k)) && !coveredKeys.has(normalize(k))).length,
				score: r.matchKeys.filter((k) => slotBasketKeys.has(normalize(k))).length
			}))
			.sort((a, b) => b.newCoverage - a.newCoverage || b.score - a.score || a.name.localeCompare(b.name));

		const recipe = available[0];
		if (!recipe) continue;

		usedIds.add(recipe.id);
		for (const k of recipe.matchKeys) {
			if (allBasketKeys.has(normalize(k))) coveredKeys.add(normalize(k));
		}
		result.push({ date, slot, course: 'main', recipeId: recipe.id, notNeeded: false });
	}

	// ── Pass 2: side courses ──
	const uncoveredKeys = new Set([...allBasketKeys].filter((k) => !coveredKeys.has(k)));
	if (uncoveredKeys.size === 0) return result;

	const sideEligible = allRecipes.filter((r) => r.course === null || r.course === 'side');

	for (const [date, slot] of slots) {
		if (sideEligible.filter((r) => !usedIds.has(r.id)).length === 0) break;

		const slotKey = `${date}-${slot}`;
		if (notNeededSlotKeys.has(slotKey)) continue;
		if (occupiedKeys.has(`${slotKey}-side`)) continue;

		const slotBasketKeys = getSlotBasketKeys(date);
		const slotUncoveredKeys = new Set([...slotBasketKeys].filter((k) => uncoveredKeys.has(k)));

		const available = sideEligible
			.filter((r) => !usedIds.has(r.id))
			.filter((r) => r.matchKeys.some((k) => slotUncoveredKeys.has(normalize(k))))
			.map((r) => ({
				...r,
				newCoverage: r.matchKeys.filter((k) => slotUncoveredKeys.has(normalize(k))).length,
				score: r.matchKeys.filter((k) => slotBasketKeys.has(normalize(k))).length
			}))
			.sort((a, b) => b.newCoverage - a.newCoverage || b.score - a.score || a.name.localeCompare(b.name));

		const recipe = available[0];
		if (!recipe) continue;

		usedIds.add(recipe.id);
		result.push({ date, slot, course: 'side', recipeId: recipe.id, notNeeded: false });
	}

	return result;
}
