import { describe, it, expect } from 'vitest';
import { suggestPlan, ALL_SLOTS } from './planning.js';
import { buildAliasMap, createKeyNormalizer } from './ingredients.js';

const noAliasNormalize = createKeyNormalizer(new Map());

const recipe = (id: number, name: string, matchKeys: string[]) => ({ id, name, matchKeys });

describe('suggestPlan', () => {
	it('assigns matching recipes to slots', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [['monday', 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ day: 'monday', slot: 'lunch', recipeId: 1, notNeeded: false });
	});

	it('skips recipes with no basket match', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Pasta', ['pasta', 'tomate'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [['monday', 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(0);
	});

	it('does not assign the same recipe twice', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [
				['monday', 'lunch'],
				['monday', 'dinner']
			],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(1); // only one recipe available
		expect(result[0].recipeId).toBe(1);
	});

	it('skips slots in usedIds', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set([1]),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [['monday', 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(0);
	});

	it('marks not-needed slots', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(['monday-lunch']),
			slots: [['monday', 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ day: 'monday', slot: 'lunch', recipeId: null, notNeeded: true });
	});

	it('skips occupied slots', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedSlotKeys: new Set(['monday-lunch']),
			notNeededSlotKeys: new Set(),
			slots: [['monday', 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(0);
	});

	it('prefers coverage-first: recipes covering new basket ingredients are picked first', () => {
		const recipes = [
			recipe(1, 'Rüebli-Risotto', ['rüebli', 'reis']),    // covers rüebli + reis
			recipe(2, 'Rüebli-Suppe', ['rüebli']),               // covers only rüebli
			recipe(3, 'Zucchini-Pfanne', ['zucchini'])           // covers zucchini
		];
		const basketKeys = new Set(['rüebli', 'zucchini', 'reis']);

		const result = suggestPlan({
			allRecipes: recipes,
			basketKeys,
			usedIds: new Set(),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [
				['monday', 'lunch'],
				['monday', 'dinner'],
				['tuesday', 'lunch']
			],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(3);
		// First slot: recipe with most coverage (rüebli + reis = 2 new)
		expect(result[0].recipeId).toBe(1);
		// Second slot: zucchini covers a new ingredient
		expect(result[1].recipeId).toBe(3);
		// Third slot: rüebli-suppe (rüebli already covered, but it's all that's left)
		expect(result[2].recipeId).toBe(2);
	});

	it('resolves aliases via normalizer', () => {
		const normalize = createKeyNormalizer(
			buildAliasMap([{ matchKeys: ['karotte', 'rüebli'] }])
		);
		// Recipe uses 'rüebli', basket has 'karotte' — alias maps rüebli→karotte
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['karotte']),
			usedIds: new Set(),
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [['monday', 'lunch']],
			normalize
		});

		expect(result).toHaveLength(1);
		expect(result[0].recipeId).toBe(1);
	});

	it('ALL_SLOTS has 14 entries (Mon–Sun, lunch+dinner)', () => {
		expect(ALL_SLOTS).toHaveLength(14);
	});
});
