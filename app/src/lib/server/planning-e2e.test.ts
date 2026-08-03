import { describe, it, expect } from 'vitest';
import { suggestPlan, generateSlots, type PlanRecipe } from './planning.js';
import { computeShoppingList } from './shopping.js';
import { buildAliasMap, createKeyNormalizer, generateMatchKeys, generateBasketMatchKey } from './ingredients.js';

/**
 * Big integration test: wires basket → weekly auto-fill → shopping list together,
 * the same way plan/+page.server.ts and shopping/+page.server.ts chain
 * suggestPlan() and computeShoppingList() in the real app.
 *
 * Covers the recurring "planning is off" complaints from the spec:
 * - Gemüsekorb delivery gating (Thursday morning → usable from Thursday lunch on)
 * - no recipe used twice within the planning period
 * - shopping list excludes basket items, Vorratskammer (lager) items and pantry staples
 * - duplicate shopping list ingredients are merged
 * - slots with no matching recipe are left empty rather than guessed
 */

// 2024-01-01 is a Monday → 2024-01-04 is Thursday.
const MON = '2024-01-01';
const TUE = '2024-01-02';
const WED = '2024-01-03';
const THU = '2024-01-04';
const FRI = '2024-01-05';
const SAT = '2024-01-06';
const SUN = '2024-01-07';

function makeRecipe(id: number, name: string, ingredients: string, course: string | null = null): PlanRecipe & { ingredients: string } {
	return { id, name, ingredients, matchKeys: generateMatchKeys(ingredients), course };
}

describe('weekly plan → shopping list integration', () => {
	const kuerbisSuppe = makeRecipe(1, 'Kürbis-Suppe', '500g Kürbis\n1 Zwiebel\nSalz');
	const lauchQuiche = makeRecipe(2, 'Lauch-Quiche', '2 Lauch\n200g Mehl\n3 Eier\n1 Zwiebel');
	// No ingredient overlaps with the basket — must never be auto-picked.
	const pastaAglioOlio = makeRecipe(3, 'Pasta Aglio e Olio', '400g Pasta\n4 Knoblauchzehen\nOlivenöl');

	const allRecipes = [kuerbisSuppe, lauchQuiche, pastaAglioOlio];
	const normalize = createKeyNormalizer(buildAliasMap([]));

	// Whole basket physically arrives Thursday morning — every item's deliveryDate is Thursday.
	const basketRaw = [
		{ displayText: '1 Kürbis', deliveryDate: THU },
		{ displayText: '2 Lauch', deliveryDate: THU }
	];
	const basketItems = basketRaw.map((b) => ({
		matchKey: generateBasketMatchKey(b.displayText),
		deliveryDate: b.deliveryDate
	}));

	// Already at home — should never show up on the shopping list.
	const lagerItems = [{ displayText: 'Eier', matchKey: generateBasketMatchKey('Eier') }];

	const weekSlots = generateSlots(MON, SUN, 'lunch');

	const planned = suggestPlan({
		allRecipes,
		basketItems,
		usedIds: new Set(),
		occupiedKeys: new Set(),
		notNeededSlotKeys: new Set(),
		slots: weekSlots,
		normalize
	});

	it('leaves every slot before Thursday lunch empty — basket is not delivered yet', () => {
		const filledDates = new Set(planned.map((e) => e.date));
		for (const day of [MON, TUE, WED]) {
			expect(filledDates.has(day)).toBe(false);
		}
	});

	it('fills Thursday lunch onwards from basket-matched recipes', () => {
		const thursdayLunch = planned.find((e) => e.date === THU && e.slot === 'lunch');
		expect(thursdayLunch?.recipeId).not.toBeNull();
	});

	it('never auto-picks a recipe with no basket ingredient match', () => {
		expect(planned.some((e) => e.recipeId === pastaAglioOlio.id)).toBe(false);
	});

	it('never uses the same recipe twice across the whole week', () => {
		const recipeIds = planned.map((e) => e.recipeId).filter((id): id is number => id !== null);
		expect(new Set(recipeIds).size).toBe(recipeIds.length);
	});

	it('runs out of matching recipes once basket coverage is used up, rather than repeating meals', () => {
		// Only 2 recipes match the basket, so at most 2 slots get filled — the rest of
		// the week (Fri–Sun) stays empty instead of reusing Kürbis-Suppe/Lauch-Quiche.
		const filledAfterThursday = planned.filter((e) => [FRI, SAT, SUN].includes(e.date));
		expect(filledAfterThursday).toHaveLength(0);
	});

	it('builds a shopping list that excludes basket items, lager items and pantry staples, and merges duplicates', () => {
		const usedRecipeIds = planned.map((e) => e.recipeId).filter((id): id is number => id !== null);
		const usedIngredients = usedRecipeIds.map((id) => allRecipes.find((r) => r.id === id)!.ingredients);

		const availableKeys = [...basketItems.map((b) => b.matchKey), ...lagerItems.map((l) => l.matchKey)];
		const shoppingList = computeShoppingList(usedIngredients, availableKeys, allRecipes, normalize);
		const keys = shoppingList.map((i) => i.matchKey);

		// In the basket → not on the list.
		expect(keys).not.toContain('kürbis');
		expect(keys).not.toContain('lauch');
		// In the Vorratskammer (lager) → not on the list.
		expect(keys).not.toContain('eier');
		// Pantry staple → never on the list, regardless of basket/lager.
		expect(keys).not.toContain('salz');

		// Still missing: onions (needed by both recipes, merged into a single line) and flour.
		expect(keys).toContain('zwiebel');
		expect(keys).toContain('mehl');
		const zwiebelLine = shoppingList.find((i) => i.matchKey === 'zwiebel');
		expect(zwiebelLine?.displayText).toBe('2 Zwiebel'); // 1 Zwiebel + 1 Zwiebel merged
	});
});

describe('weekly plan: mid-week start leaves earlier slots untouched', () => {
	const recipe = makeRecipe(1, 'Rüebli-Suppe', '3 Rüebli');
	const normalize = createKeyNormalizer(buildAliasMap([]));
	const basketItems = [{ matchKey: 'rüebli', deliveryDate: null }];

	it('planning from Wednesday dinner onwards never generates Monday/Tuesday/Wednesday-lunch slots', () => {
		const slots = generateSlots(WED, SUN, 'dinner');
		const planned = suggestPlan({
			allRecipes: [recipe],
			basketItems,
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots,
			normalize
		});

		expect(planned.some((e) => e.date === MON || e.date === TUE)).toBe(false);
		expect(planned.some((e) => e.date === WED && e.slot === 'lunch')).toBe(false);
		expect(planned.find((e) => e.date === WED && e.slot === 'dinner')?.recipeId).toBe(1);
	});
});
