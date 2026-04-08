import { describe, it, expect } from 'vitest';
import { suggestPlan, generateSlots } from './planning.js';
import { buildAliasMap, createKeyNormalizer } from './ingredients.js';

const noAliasNormalize = createKeyNormalizer(new Map());

const recipe = (id: number, name: string, matchKeys: string[], course: string | null = null) => ({
	id,
	name,
	matchKeys,
	course
});

// Fixed test dates: 2024-01-01 is a Monday
const D0 = '2024-01-01';
const D1 = '2024-01-02';
const D2 = '2024-01-03';

describe('suggestPlan', () => {
	it('assigns matching recipes to slots', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ date: D0, slot: 'lunch', course: 'main', recipeId: 1, notNeeded: false });
	});

	it('skips recipes with no basket match', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Pasta', ['pasta', 'tomate'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(0);
	});

	it('does not assign the same recipe twice', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [
				[D0, 'lunch'],
				[D0, 'dinner']
			],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(1);
		expect(result[0].recipeId).toBe(1);
	});

	it('skips slots in usedIds', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set([1]),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(0);
	});

	it('marks not-needed slots', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set([`${D0}-lunch`]),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ date: D0, slot: 'lunch', course: 'main', recipeId: null, notNeeded: true });
	});

	it('skips occupied slots', () => {
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['rüebli']),
			usedIds: new Set([1]),
			occupiedKeys: new Set([`${D0}-lunch-main`]),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result).toHaveLength(0);
	});

	it('prefers coverage-first: recipes covering new basket ingredients are picked first', () => {
		const recipes = [
			recipe(1, 'Rüebli-Risotto', ['rüebli', 'reis']),
			recipe(2, 'Rüebli-Suppe', ['rüebli']),
			recipe(3, 'Zucchini-Pfanne', ['zucchini'])
		];
		const basketKeys = new Set(['rüebli', 'zucchini', 'reis']);

		const result = suggestPlan({
			allRecipes: recipes,
			basketKeys,
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [
				[D0, 'lunch'],
				[D0, 'dinner'],
				[D1, 'lunch']
			],
			normalize: noAliasNormalize
		});

		const mains = result.filter((e) => e.course === 'main');
		expect(mains[0].recipeId).toBe(1); // rüebli + reis = 2 new keys
		expect(mains[1].recipeId).toBe(3); // zucchini covers new key
		expect(mains[2].recipeId).toBe(2); // rüebli-suppe last
	});

	it('resolves aliases via normalizer', () => {
		const normalize = createKeyNormalizer(
			buildAliasMap([{ matchKeys: ['karotte', 'rüebli'] }])
		);
		const result = suggestPlan({
			allRecipes: [recipe(1, 'Rüebli-Suppe', ['rüebli'])],
			basketKeys: new Set(['karotte']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize
		});

		expect(result).toHaveLength(1);
		expect(result[0].recipeId).toBe(1);
	});

	// ── generateSlots tests ──

	it('generateSlots covers start to end inclusive, both slots per day', () => {
		const slots = generateSlots(D0, D2);
		expect(slots).toHaveLength(6); // 3 days × 2 slots
		expect(slots[0]).toEqual([D0, 'lunch']);
		expect(slots[5]).toEqual([D2, 'dinner']);
	});

	it('generateSlots with dinner start skips lunch on first day', () => {
		const slots = generateSlots(D0, D1, 'dinner');
		expect(slots).toHaveLength(3); // D0-dinner, D1-lunch, D1-dinner
		expect(slots[0]).toEqual([D0, 'dinner']);
		expect(slots[1]).toEqual([D1, 'lunch']);
	});

	// ── Course-aware tests ──

	it('fills side slot when basket keys remain uncovered after mains', () => {
		const recipes = [
			recipe(1, 'Rüebli-Suppe', ['rüebli'], 'main'),
			recipe(2, 'Zucchini-Salat', ['zucchini'], 'side')
		];

		const result = suggestPlan({
			allRecipes: recipes,
			basketKeys: new Set(['rüebli', 'zucchini']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		const main = result.find((e) => e.course === 'main');
		const side = result.find((e) => e.course === 'side');
		expect(main?.recipeId).toBe(1);
		expect(side?.recipeId).toBe(2);
	});

	it('does not fill side when all basket keys are already covered by mains', () => {
		const recipes = [
			recipe(1, 'Rüebli-Suppe', ['rüebli'], null),
			recipe(2, 'Rüebli-Salat', ['rüebli'], 'side')
		];

		const result = suggestPlan({
			allRecipes: recipes,
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		expect(result.filter((e) => e.course === 'side')).toHaveLength(0);
	});

	it('prefers main recipe over side recipe for same basket key', () => {
		const recipes = [
			recipe(1, 'Rüebli-Kuchen', ['rüebli'], 'main'),
			recipe(2, 'Rüebli-Salat', ['rüebli'], 'side')
		];

		const result = suggestPlan({
			allRecipes: recipes,
			basketKeys: new Set(['rüebli']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		const main = result.find((e) => e.course === 'main');
		expect(main?.recipeId).toBe(1);
		expect(result.filter((e) => e.course === 'side')).toHaveLength(0);
	});

	it('does not reuse same recipe as both main and side', () => {
		const recipes = [
			recipe(1, 'Rüebli-Gericht', ['rüebli'], null),
			recipe(2, 'Zucchini-Gericht', ['zucchini'], null)
		];

		const result = suggestPlan({
			allRecipes: recipes,
			basketKeys: new Set(['rüebli', 'zucchini']),
			usedIds: new Set(),
			occupiedKeys: new Set(),
			notNeededSlotKeys: new Set(),
			slots: [[D0, 'lunch']],
			normalize: noAliasNormalize
		});

		const ids = result.map((e) => e.recipeId);
		expect(new Set(ids).size).toBe(ids.length); // no duplicates
	});
});
