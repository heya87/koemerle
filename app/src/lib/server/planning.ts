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
 */
export function suggestPlan(params: {
	allRecipes: PlanRecipe[];
	basketKeys: Set<string>;
	usedIds: Set<number>;
	occupiedKeys: Set<string>;
	notNeededSlotKeys: Set<string>;
	slots: [string, Slot][]; // [date, slot]
	normalize: KeyNormalizer;
}): PlanEntry[] {
	const { allRecipes, basketKeys, usedIds, occupiedKeys, notNeededSlotKeys, slots, normalize } = params;

	const result: PlanEntry[] = [];
	const coveredKeys = new Set<string>();

	function score(r: PlanRecipe) {
		return r.matchKeys.filter((k) => basketKeys.has(normalize(k))).length;
	}

	function filterAndScore(eligible: PlanRecipe[]) {
		return eligible
			.map((r) => ({ ...r, score: score(r) }))
			.filter((r) => r.score > 0 && !usedIds.has(r.id));
	}

	// ── Pass 1: main courses ──
	const mainEligible = allRecipes.filter((r) => r.course === null || r.course === 'main');
	let mainAvailable = filterAndScore(mainEligible);

	for (const [date, slot] of slots) {
		const slotKey = `${date}-${slot}`;

		if (notNeededSlotKeys.has(slotKey)) {
			result.push({ date, slot, course: 'main', recipeId: null, notNeeded: true });
			continue;
		}

		if (occupiedKeys.has(`${slotKey}-main`)) continue;

		mainAvailable.sort((a, b) => {
			const newA = a.matchKeys.filter((k) => basketKeys.has(normalize(k)) && !coveredKeys.has(normalize(k))).length;
			const newB = b.matchKeys.filter((k) => basketKeys.has(normalize(k)) && !coveredKeys.has(normalize(k))).length;
			return newB - newA || b.score - a.score || a.name.localeCompare(b.name);
		});

		const recipe = mainAvailable.shift();
		if (!recipe) continue;

		usedIds.add(recipe.id);
		for (const k of recipe.matchKeys) {
			if (basketKeys.has(normalize(k))) coveredKeys.add(normalize(k));
		}
		result.push({ date, slot, course: 'main', recipeId: recipe.id, notNeeded: false });
	}

	// ── Pass 2: side courses ──
	const uncoveredKeys = new Set([...basketKeys].filter((k) => !coveredKeys.has(k)));
	if (uncoveredKeys.size === 0) return result;

	const sideEligible = allRecipes.filter((r) => r.course === null || r.course === 'side');
	let sideAvailable = filterAndScore(sideEligible).filter((r) =>
		r.matchKeys.some((k) => uncoveredKeys.has(normalize(k)))
	);

	for (const [date, slot] of slots) {
		if (sideAvailable.length === 0) break;

		const slotKey = `${date}-${slot}`;
		if (notNeededSlotKeys.has(slotKey)) continue;
		if (occupiedKeys.has(`${slotKey}-side`)) continue;

		sideAvailable.sort((a, b) => {
			const newA = a.matchKeys.filter((k) => uncoveredKeys.has(normalize(k))).length;
			const newB = b.matchKeys.filter((k) => uncoveredKeys.has(normalize(k))).length;
			return newB - newA || b.score - a.score || a.name.localeCompare(b.name);
		});

		const recipe = sideAvailable.shift();
		if (!recipe) continue;

		usedIds.add(recipe.id);
		result.push({ date, slot, course: 'side', recipeId: recipe.id, notNeeded: false });
	}

	return result;
}
