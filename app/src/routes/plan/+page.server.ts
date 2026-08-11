import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems, mealPlanEntries, planMeta, activityLog, ingredientGroups, plantFoods } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getWeekStart, createKeyNormalizer, buildAliasMap, generateMatchKeys } from '$lib/server/ingredients';
import { suggestPlan, generateSlots } from '$lib/server/planning';
import type { Slot, Course } from '$lib/server/planning';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { DEFAULT_CLAUDE_PROMPT } from '$lib/server/claude';
import { searchFooby, fetchFoobyRecipe } from '$lib/server/fooby';
import { getFamily } from '$lib/server/families';

const NOT_NEEDED = '__not_needed__';

const SLOT_LABELS: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' };
const COURSE_LABELS: Record<string, string> = { main: 'Hauptgang', side: 'Beilage' };

function isValidDate(d: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

function formatDateLabel(iso: string): string {
	const d = new Date(iso + 'T12:00:00Z');
	const names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
	return `${names[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

// Deletes any transient (Claude/Fooby-suggested, not explicitly saved) recipe belonging
// to this family that's no longer referenced by any of this family's plan entries.
async function cleanupOrphanedTransients(familyId: number): Promise<void> {
	const referencedIds = await db
		.select({ id: mealPlanEntries.recipeId })
		.from(mealPlanEntries)
		.where(eq(mealPlanEntries.familyId, familyId))
		.then((rows) => new Set(rows.map((r) => r.id).filter((id): id is number => id !== null)));
	const familyTransients = await db
		.select({ id: recipes.id })
		.from(recipes)
		.where(and(eq(recipes.familyId, familyId), eq(recipes.transient, true)));
	const orphaned = familyTransients.filter((r) => !referencedIds.has(r.id));
	if (orphaned.length > 0) {
		await Promise.all(orphaned.map((r) => db.delete(recipes).where(and(eq(recipes.id, r.id), eq(recipes.familyId, familyId)))));
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const familyId = locals.user!.familyId;
	const today = new Date().toISOString().split('T')[0];
	const weekStart = getWeekStart();

	const [allRecipes, basket, entries, metaRows, groups, plantFoodRows] = await Promise.all([
		db.select().from(recipes).where(eq(recipes.familyId, familyId)).orderBy(recipes.name),
		db.select().from(basketItems).where(and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart))),
		db.select().from(mealPlanEntries).where(eq(mealPlanEntries.familyId, familyId)),
		db.select().from(planMeta).where(eq(planMeta.familyId, familyId)).limit(1),
		db.select().from(ingredientGroups),
		db.select().from(plantFoods)
	]);

	const meta = metaRows[0] ?? null;
	const normalize = createKeyNormalizer(buildAliasMap(groups));

	const plantKeySet = new Set(plantFoodRows.map((p) => normalize(p.matchKey)));
	const plantLabelMap = new Map(plantFoodRows.map((p) => [normalize(p.matchKey), p.label]));

	// Count plants within the active plan period only
	const planEntries = meta
		? entries.filter((e) => e.date >= meta.planStart && e.date <= meta.planEnd)
		: entries;

	const foundPlants = new Map<string, string>();
	for (const entry of planEntries) {
		if (!entry.recipeId) continue;
		const recipe = allRecipes.find((r) => r.id === entry.recipeId);
		if (!recipe) continue;
		for (const key of recipe.matchKeys) {
			const norm = normalize(key);
			if (plantKeySet.has(norm) && !foundPlants.has(norm)) {
				foundPlants.set(norm, plantLabelMap.get(norm) ?? key);
			}
		}
	}

	// Nutrient aggregation — sum across all plan entries that have a recipe with data
	let totalKcal = 0, totalFatG = 0, totalCarbsG = 0, totalProteinG = 0;
	let mealsWithData = 0, totalMealsWithRecipe = 0;

	for (const entry of planEntries) {
		if (!entry.recipeId) continue;
		const recipe = allRecipes.find((r) => r.id === entry.recipeId);
		if (!recipe) continue;
		totalMealsWithRecipe++;
		if (recipe.kcal == null) continue;
		mealsWithData++;
		totalKcal += recipe.kcal;
		totalFatG += recipe.fatG ?? 0;
		totalCarbsG += recipe.carbsG ?? 0;
		totalProteinG += recipe.proteinG ?? 0;
	}

	const hasData = totalMealsWithRecipe > 0 && mealsWithData / totalMealsWithRecipe >= 0.5;
	const fatKcal = totalFatG * 9;
	const carbsKcal = totalCarbsG * 4;
	const proteinKcal = totalProteinG * 4;
	const macroTotal = fatKcal + carbsKcal + proteinKcal;

	const family = await getFamily(familyId);

	return {
		today,
		allRecipes,
		basket,
		entries,
		meta,
		claudeEnabled: family?.claudeEnabled ?? false,
		plantCount: foundPlants.size,
		plantGoal: 30,
		nutrientSummary: {
			hasData,
			mealsWithData,
			totalMealsWithRecipe,
			totalKcal,
			actualCarbsPct: hasData && macroTotal > 0 ? carbsKcal / macroTotal : null,
			actualFatPct:   hasData && macroTotal > 0 ? fatKcal   / macroTotal : null,
			actualProteinPct: hasData && macroTotal > 0 ? proteinKcal / macroTotal : null
		}
	};
};

export const actions: Actions = {
	// Compute a suggestion and return it — no DB write.
	getSuggestion: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const fd = await request.formData();
		const startDate = fd.get('startDate')?.toString() ?? '';
		const endDate = fd.get('endDate')?.toString() ?? '';
		const startSlot = (fd.get('startSlot')?.toString() ?? 'lunch') as Slot;

		if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
			return fail(400, { message: 'Ungültige Datumsangaben' });
		}
		if (!['lunch', 'dinner'].includes(startSlot)) {
			return fail(400, { message: 'Ungültiger Slot' });
		}

		const weekStart = getWeekStart();
		const [basket, allRecipes, existing, groups] = await Promise.all([
			db.select().from(basketItems).where(and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart))),
			db.select().from(recipes).where(eq(recipes.familyId, familyId)),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.familyId, familyId)),
			db.select().from(ingredientGroups)
		]);

		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const notNeededKeys = new Set(fd.getAll('notNeeded').map((v) => v.toString()));
		const allSlots = generateSlots(startDate, endDate, startSlot);
		const allSlotKeys = new Set(allSlots.map(([d, s]) => `${d}-${s}`));

		// Recipes from entries outside the planning range count as "used"
		const outsideEntries = existing.filter((e) => !allSlotKeys.has(`${e.date}-${e.slot}`));
		const usedIds = new Set(
			outsideEntries.map((e) => e.recipeId).filter((id): id is number => id !== null)
		);

		const planned = suggestPlan({
			allRecipes,
			basketItems: basket.map((b) => ({ matchKey: b.matchKey, deliveryDate: b.deliveryDate })),
			usedIds,
			occupiedKeys: new Set(),
			notNeededSlotKeys: notNeededKeys,
			slots: allSlots,
			normalize
		});

		const recipeById = new Map(allRecipes.map((r) => [r.id, r]));
		const suggestion = planned.map((e) => ({
			...e,
			recipeName: e.recipeId ? (recipeById.get(e.recipeId)?.name ?? null) : null,
			recipeUrl: e.recipeId ? (recipeById.get(e.recipeId)?.recipeUrl ?? null) : null
		}));

		return { suggestion, startDate, endDate, startSlot };
	},

	// Compute a suggestion and save it directly — skips draft review.
	quickPlan: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const fd = await request.formData();
		const startDate = fd.get('startDate')?.toString() ?? '';
		const endDate = fd.get('endDate')?.toString() ?? '';
		const startSlot = (fd.get('startSlot')?.toString() ?? 'lunch') as Slot;

		if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
			return fail(400, { message: 'Ungültige Datumsangaben' });
		}

		const weekStart = getWeekStart();
		const [basket, allRecipes, existing, groups] = await Promise.all([
			db.select().from(basketItems).where(and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart))),
			db.select().from(recipes).where(eq(recipes.familyId, familyId)),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.familyId, familyId)),
			db.select().from(ingredientGroups)
		]);

		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const notNeededKeys = new Set(fd.getAll('notNeeded').map((v) => v.toString()));
		const allSlots = generateSlots(startDate, endDate, startSlot);
		const allSlotKeys = new Set(allSlots.map(([d, s]) => `${d}-${s}`));

		const outsideEntries = existing.filter((e) => !allSlotKeys.has(`${e.date}-${e.slot}`));
		const usedIds = new Set(
			outsideEntries.map((e) => e.recipeId).filter((id): id is number => id !== null)
		);

		const newEntries = suggestPlan({
			allRecipes,
			basketItems: basket.map((b) => ({ matchKey: b.matchKey, deliveryDate: b.deliveryDate })),
			usedIds,
			occupiedKeys: new Set(),
			notNeededSlotKeys: notNeededKeys,
			slots: allSlots,
			normalize
		});

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		await db.delete(planMeta).where(eq(planMeta.familyId, familyId));
		await db.insert(planMeta).values({ familyId, planStart: startDate, planEnd: endDate, planningStartSlot: startSlot });

		await db.delete(mealPlanEntries).where(
			and(eq(mealPlanEntries.familyId, familyId), gte(mealPlanEntries.date, startDate), lte(mealPlanEntries.date, endDate))
		);

		if (newEntries.length > 0) {
			await db.insert(mealPlanEntries).values(
				newEntries.map((e) => ({
					familyId,
					date: e.date,
					slot: e.slot,
					course: e.course,
					recipeId: e.notNeeded ? null : (e.recipeId ?? null),
					freeText: e.notNeeded ? NOT_NEEDED : null,
					updatedBy: userName,
					updatedAt: new Date()
				}))
			);
		}

		await db.insert(activityLog).values({
			familyId,
			logDate: today,
			userId: user.id,
			message: `${userName} hat den Plan neu erstellt (${formatDateLabel(startDate)}–${formatDateLabel(endDate)})`,
			createdAt: new Date()
		});
	},

	// Save the confirmed plan to DB.
	confirmPlan: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const fd = await request.formData();
		const startDate = fd.get('startDate')?.toString() ?? '';
		const endDate = fd.get('endDate')?.toString() ?? '';
		const startSlot = fd.get('startSlot')?.toString() ?? 'lunch';
		const entriesJson = fd.get('entries')?.toString() ?? '[]';

		if (!isValidDate(startDate) || !isValidDate(endDate)) {
			return fail(400, { message: 'Ungültige Datumsangaben' });
		}

		type NewMeal = { name: string; recipeUrl?: string | null; ingredients: string; instructions: string; kcal: number | null; fatG: number | null; carbsG: number | null; proteinG: number | null; permanent: boolean };
		let entries: {
			date: string;
			slot: Slot;
			course: Course;
			recipeId: number | null;
			recipeName?: string | null;
			notNeeded: boolean;
			newMeal?: NewMeal | null;
		}[];
		try {
			entries = JSON.parse(entriesJson);
		} catch {
			return fail(400, { message: 'Ungültige Daten' });
		}

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		// Insert new Claude-suggested meals as recipes, resolve their IDs
		const resolvedEntries = await Promise.all(
			entries.map(async (e) => {
				if (e.notNeeded || e.recipeId || !e.newMeal?.name?.trim()) return e;
				const meal = e.newMeal;
				const matchKeys = generateMatchKeys(meal.ingredients);
				const [inserted] = await db.insert(recipes).values({
					familyId,
					name: meal.name.trim(),
					ingredients: meal.ingredients.trim(),
					preparation: meal.instructions?.trim() || null,
					recipeUrl: meal.recipeUrl ?? null,
					matchKeys,
					kcal: meal.kcal ?? null,
					fatG: meal.fatG ?? null,
					carbsG: meal.carbsG ?? null,
					proteinG: meal.proteinG ?? null,
					transient: !meal.permanent
				}).returning({ id: recipes.id });
				return { ...e, recipeId: inserted.id };
			})
		);

		await db.delete(planMeta).where(eq(planMeta.familyId, familyId));
		await db.insert(planMeta).values({ familyId, planStart: startDate, planEnd: endDate, planningStartSlot: startSlot });

		await db.delete(mealPlanEntries).where(
			and(eq(mealPlanEntries.familyId, familyId), gte(mealPlanEntries.date, startDate), lte(mealPlanEntries.date, endDate))
		);

		if (resolvedEntries.length > 0) {
			await db.insert(mealPlanEntries).values(
				resolvedEntries.map((e) => ({
					familyId,
					date: e.date,
					slot: e.slot,
					course: e.course ?? 'main',
					recipeId: e.notNeeded ? null : (e.recipeId ?? null),
					freeText: e.notNeeded ? NOT_NEEDED : null,
					updatedBy: userName,
					updatedAt: new Date()
				}))
			);
		}

		// Clean up transient recipes no longer referenced by any plan entry (this family only)
		await cleanupOrphanedTransients(familyId);

		await db.insert(activityLog).values({
			familyId,
			logDate: today,
			userId: user.id,
			message: `${userName} hat den Plan bestätigt`,
			createdAt: new Date()
		});
	},

	setSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const fd = await request.formData();
		const date = fd.get('date')?.toString() ?? '';
		const slot = fd.get('slot')?.toString() as Slot;
		const course = (fd.get('course')?.toString() ?? 'main') as Course;

		if (!isValidDate(date) || !['lunch', 'dinner'].includes(slot)) {
			return fail(400, { message: 'Ungültiger Slot' });
		}
		if (!['main', 'side'].includes(course)) return fail(400, { message: 'Ungültiger Kurs' });

		const recipeIdStr = fd.get('recipeId')?.toString();
		const freeText = fd.get('freeText')?.toString().trim() ?? '';
		const recipeId = recipeIdStr ? Number(recipeIdStr) : null;
		if (!recipeId && !freeText) return fail(400, { message: 'Rezept oder Text erforderlich' });

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		await db
			.insert(mealPlanEntries)
			.values({
				familyId,
				date,
				slot,
				course,
				recipeId: recipeId ?? null,
				freeText: recipeId ? null : freeText,
				updatedBy: userName,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: [mealPlanEntries.familyId, mealPlanEntries.date, mealPlanEntries.slot, mealPlanEntries.course],
				set: {
					recipeId: recipeId ?? null,
					freeText: recipeId ? null : freeText,
					updatedBy: userName,
					updatedAt: new Date()
				}
			});

		await db.insert(activityLog).values({
			familyId,
			logDate: today,
			userId: user.id,
			message: `${userName} hat ${formatDateLabel(date)} ${SLOT_LABELS[slot]} ${COURSE_LABELS[course] ?? ''} geändert`,
			createdAt: new Date()
		});
	},

	clearSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const fd = await request.formData();
		const date = fd.get('date')?.toString() ?? '';
		const slot = fd.get('slot')?.toString() as Slot;
		const course = (fd.get('course')?.toString() ?? 'main') as Course;

		if (!isValidDate(date) || !['lunch', 'dinner'].includes(slot)) {
			return fail(400, { message: 'Ungültiger Slot' });
		}

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		await db
			.delete(mealPlanEntries)
			.where(
				and(
					eq(mealPlanEntries.familyId, familyId),
					eq(mealPlanEntries.date, date),
					eq(mealPlanEntries.slot, slot),
					eq(mealPlanEntries.course, course)
				)
			);

		await db.insert(activityLog).values({
			familyId,
			logDate: today,
			userId: user.id,
			message: `${userName} hat ${formatDateLabel(date)} ${SLOT_LABELS[slot]} ${COURSE_LABELS[course] ?? ''} geleert`,
			createdAt: new Date()
		});
	},

	getClaudeSuggestion: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const family = await getFamily(familyId);
		if (!family?.claudeEnabled) return fail(403, { message: 'Claude-Vorschläge sind für eure Familie nicht aktiviert.' });

		const { ANTHROPIC_API_KEY } = env;
		if (!ANTHROPIC_API_KEY) return fail(500, { message: 'ANTHROPIC_API_KEY fehlt in den Umgebungsvariablen.' });

		const fd = await request.formData();
		const startDate = fd.get('startDate')?.toString() ?? '';
		const endDate = fd.get('endDate')?.toString() ?? '';
		const startSlot = (fd.get('startSlot')?.toString() ?? 'lunch') as Slot;

		if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
			return fail(400, { message: 'Ungültige Datumsangaben' });
		}

		const weekStart = getWeekStart();

		// Clean up transient recipes not referenced by any plan entry before building a new suggestion
		await cleanupOrphanedTransients(familyId);

		const [basket, allRecipes, existing, groups] = await Promise.all([
			db.select().from(basketItems).where(and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart))),
			db.select().from(recipes).where(and(eq(recipes.familyId, familyId), eq(recipes.transient, false))),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.familyId, familyId)),
			db.select().from(ingredientGroups)
		]);
		const promptTemplate = family.claudePromptTemplate || DEFAULT_CLAUDE_PROMPT;

		const allSlots = generateSlots(startDate, endDate, startSlot);
		const allSlotKeys = new Set(allSlots.map(([d, s]) => `${d}-${s}`));
		const notNeededFormKeys = new Set(fd.getAll('notNeeded').map((v) => v.toString()));

		// Recipe IDs used outside the planning range (prevent cross-week duplicates)
		const outsideEntries = existing.filter((e) => !allSlotKeys.has(`${e.date}-${e.slot}`));
		const usedIds = new Set(
			outsideEntries.map((e) => e.recipeId).filter((id): id is number => id !== null)
		);

		// Step 1: run local suggestPlan first — fills basket-matched slots
		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const localResults = suggestPlan({
			allRecipes,
			basketItems: basket.map((b) => ({ matchKey: b.matchKey, deliveryDate: b.deliveryDate })),
			usedIds,
			occupiedKeys: new Set(),
			notNeededSlotKeys: notNeededFormKeys,
			slots: allSlots,
			normalize
		});

		const localFilledKeys = new Set(
			localResults.filter((e) => !e.notNeeded).map((e) => `${e.date}-${e.slot}`)
		);
		const localUsedIds = new Set(
			localResults.map((e) => e.recipeId).filter((id): id is number => id !== null)
		);
		const allUsedIds = new Set([...usedIds, ...localUsedIds]);

		// Step 2: find slots still empty after local planning
		const emptyForClaude = allSlots.filter(
			([d, s]) => !localFilledKeys.has(`${d}-${s}`) && !notNeededFormKeys.has(`${d}-${s}`)
		);

		const recipeById = new Map(allRecipes.map((r) => [r.id, r]));

		type PlanSuggestionEntry = {
			date: string;
			slot: Slot;
			course: Course;
			recipeId: number | null;
			recipeName: string | null;
			recipeUrl: string | null;
			notNeeded: boolean;
			claudeSuggested: boolean;
			isNew: boolean;
			newMeal: {
				name: string;
				recipeUrl: string | null;
				ingredients: string;
				instructions: string;
				kcal: number | null;
				fatG: number | null;
				carbsG: number | null;
				proteinG: number | null;
				permanent: boolean;
			} | null;
		};

		// Build local suggestion entries (claudeSuggested: false)
		const localEntries: PlanSuggestionEntry[] = localResults
			.filter((e) => !e.notNeeded)
			.map((e) => ({
				date: e.date,
				slot: e.slot,
				course: e.course,
				recipeId: e.recipeId ?? null,
				recipeName: e.recipeId ? (recipeById.get(e.recipeId)?.name ?? null) : null,
				recipeUrl: e.recipeId ? (recipeById.get(e.recipeId)?.recipeUrl ?? null) : null,
				notNeeded: false,
				claudeSuggested: false,
				isNew: false,
				newMeal: null
			}));

		// Step 3: ask Claude only about remaining empty slots
		let claudeEntries: PlanSuggestionEntry[] = [];
		if (emptyForClaude.length > 0) {
			const basketList = basket.map((b) => b.displayText).join(', ') || 'keine Angaben';
			const availableRecipes = allRecipes
				.filter((r) => !allUsedIds.has(r.id))
				.map((r) => ({ id: r.id, name: r.name, ingredients: r.ingredients.substring(0, 150) }));

			const localMealLines = localEntries.map(
				(e) => `${formatDateLabel(e.date)} ${SLOT_LABELS[e.slot]}: ${e.recipeName ?? '?'}`
			);
			const filledDescription = localMealLines.length > 0 ? localMealLines.join('\n') : 'noch nichts geplant';

			const slotDescriptions = emptyForClaude
				.map(([d, s]) => `${formatDateLabel(d)} ${SLOT_LABELS[s]} — date="${d}" slot="${s}"`)
				.join('\n');

			const prompt = promptTemplate
				.replace('{basketList}', basketList)
				.replace('{filledSlots}', filledDescription)
				.replace('{availableRecipes}', JSON.stringify(availableRecipes))
				.replace('{emptySlots}', slotDescriptions);

			const foobyTools: Anthropic.Tool[] = [
				{
					name: 'search_fooby',
					description: 'Sucht Rezepte auf fooby.ch. Gibt max. 5 Treffer mit Name und URL zurück.',
					input_schema: {
						type: 'object',
						properties: {
							query: { type: 'string', description: 'Suchbegriff auf Deutsch, z.B. "Lachs Zucchini" oder "Linsensuppe"' }
						},
						required: ['query']
					}
				},
				{
					name: 'fetch_fooby_recipe',
					description: 'Lädt ein Fooby-Rezept und gibt Zutaten, Zubereitung und Nährwerte zurück.',
					input_schema: {
						type: 'object',
						properties: {
							url: { type: 'string', description: 'Die URL des Fooby-Rezepts' }
						},
						required: ['url']
					}
				}
			];

			let rawText: string;
			const fetchedFoobyRecipes = new Map<string, Awaited<ReturnType<typeof fetchFoobyRecipe>>>();
			try {
				const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
				const messages: MessageParam[] = [{ role: 'user', content: prompt }];
				console.log('[Claude] sending request, empty slots:', emptyForClaude.length, ', available recipes:', availableRecipes.length, ', fetchedFooby before loop:', fetchedFoobyRecipes.size);

				let iterations = 0;
				while (true) {
					if (++iterations > 10) throw new Error('too many tool call iterations');

					const response = await client.messages.create({
						model: 'claude-haiku-4-5-20251001',
						max_tokens: 4000,
						tools: foobyTools,
						messages
					});

					if (response.stop_reason === 'end_turn') {
						const block = response.content.find((c) => c.type === 'text');
						if (!block || block.type !== 'text') throw new Error('no text block');
						rawText = block.text;
						console.log('[Claude] finished after', iterations, 'iteration(s), fooby recipes fetched:', fetchedFoobyRecipes.size);
						console.log('[Claude] raw response:', rawText);
						break;
					}

					if (response.stop_reason === 'tool_use') {
						messages.push({ role: 'assistant', content: response.content });
						const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
						console.log('[Claude] tool calls:', toolUses.map((t) => `${t.name}(${JSON.stringify(t.input)})`));

						const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
							toolUses.map(async (tool) => {
								let content: string;
								try {
									if (tool.name === 'search_fooby') {
										const { results } = await searchFooby((tool.input as { query: string }).query);
										content = JSON.stringify(results.slice(0, 5));
									} else if (tool.name === 'fetch_fooby_recipe') {
										const url = (tool.input as { url: string }).url;
										const recipe = await fetchFoobyRecipe(url);
										fetchedFoobyRecipes.set(url, recipe);
										content = JSON.stringify(recipe);
									} else {
										content = JSON.stringify({ error: 'unknown tool' });
									}
								} catch (e) {
									content = JSON.stringify({ error: String(e) });
								}
								console.log('[Claude] tool result for', tool.name, ':', content.substring(0, 200));
								return { type: 'tool_result' as const, tool_use_id: tool.id, content };
							})
						);
						messages.push({ role: 'user', content: toolResults });
					} else {
						throw new Error(`unexpected stop_reason: ${response.stop_reason}`);
					}
				}
			} catch (e) {
				console.error('[Claude] API error:', e);
				return fail(500, { message: 'Fehler beim Aufruf der Claude API.' });
			}

			type ClaudeRaw = {
				date: string;
				slot: string;
				recipeId: number | null;
				recipeName: string | null;
				recipeUrl?: string | null;
				ingredients?: string | null;
				instructions?: string | null;
				kcal?: number | null;
				fatG?: number | null;
				carbsG?: number | null;
				proteinG?: number | null;
			};
			let parsed: ClaudeRaw[];
			try {
				// Strip markdown code fences, then extract the JSON array
				const stripped = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
				const start = stripped.indexOf('[');
				const end = stripped.lastIndexOf(']');
				if (start === -1 || end === -1) throw new Error('no JSON array found');
				const clean = stripped.slice(start, end + 1);
				console.log('[Claude] cleaned JSON:', clean.substring(0, 300));
				parsed = JSON.parse(clean);
				if (!Array.isArray(parsed)) throw new Error('not array');
			} catch (e) {
				console.error('[Claude] JSON parse error:', e, '\nRaw response:', rawText);
				return fail(500, { message: 'Claude hat kein gültiges JSON zurückgegeben.' });
			}

			const emptySlotKeys = new Set(emptyForClaude.map(([d, s]) => `${d}-${s}`));
			const filteredParsed = parsed.filter(
				(e) => isValidDate(e.date) && ['lunch', 'dinner'].includes(e.slot) && emptySlotKeys.has(`${e.date}-${e.slot}`)
			);

			// Use Fooby data cached during tool loop. Entries without a real, fetched
			// Fooby recipe are dropped — never fall back to a self-invented meal.
			// Recipes already used (outside the range, by local suggestions, or by an
			// earlier Claude entry in this same response) are rejected here too — Claude
			// is told not to repeat a recipe, but nothing else in this codepath enforces it.
			const claimedIds = new Set(allUsedIds);
			claudeEntries = filteredParsed.flatMap((e): PlanSuggestionEntry[] => {
					const rid = e.recipeId && recipeById.has(e.recipeId) && !claimedIds.has(e.recipeId) ? e.recipeId : null;
					if (rid !== null) {
						claimedIds.add(rid);
						return [{
							date: e.date,
							slot: e.slot as Slot,
							course: 'main' as Course,
							recipeId: rid,
							recipeName: recipeById.get(rid)?.name ?? e.recipeName ?? null,
							recipeUrl: recipeById.get(rid)?.recipeUrl ?? null,
							notNeeded: false,
							claudeSuggested: true,
							isNew: false,
							newMeal: null
						}];
					}

					const fooby = e.recipeUrl ? fetchedFoobyRecipes.get(e.recipeUrl) : null;
					if (!fooby) {
						console.warn('[Claude] dropping slot without a fetched Fooby recipe:', e.date, e.slot, e.recipeName);
						return [];
					}

					return [{
						date: e.date,
						slot: e.slot as Slot,
						course: 'main' as Course,
						recipeId: null,
						recipeName: e.recipeName ?? fooby.name,
						recipeUrl: null,
						notNeeded: false,
						claudeSuggested: true,
						isNew: true,
						newMeal: {
							name: e.recipeName ?? fooby.name,
							recipeUrl: fooby.url,
							ingredients: fooby.ingredients,
							instructions: e.instructions ?? '',
							kcal: fooby.kcal,
							fatG: fooby.fatG,
							carbsG: fooby.carbsG,
							proteinG: fooby.proteinG,
							permanent: false
						}
					}];
				});
		}

		const suggestion = [...localEntries, ...claudeEntries];
		return { suggestion, startDate, endDate, startSlot, source: 'claude' as const };
	},

	moveSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);
		const familyId = user.familyId;

		const fd = await request.formData();
		const fromDate = fd.get('fromDate')?.toString() ?? '';
		const fromSlot = fd.get('fromSlot')?.toString() as Slot;
		const fromCourse = (fd.get('fromCourse')?.toString() ?? 'main') as Course;
		const toDate = fd.get('toDate')?.toString() ?? '';
		const toSlot = fd.get('toSlot')?.toString() as Slot;
		const toCourse = (fd.get('toCourse')?.toString() ?? 'main') as Course;

		if (
			!isValidDate(fromDate) || !['lunch', 'dinner'].includes(fromSlot) ||
			!isValidDate(toDate) || !['lunch', 'dinner'].includes(toSlot)
		) {
			return fail(400, { message: 'Ungültiger Slot' });
		}

		if (fromDate === toDate && fromSlot === toSlot && fromCourse === toCourse) return;

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		const [fromEntry, toEntry] = await Promise.all([
			db
				.select()
				.from(mealPlanEntries)
				.where(
					and(
						eq(mealPlanEntries.familyId, familyId),
						eq(mealPlanEntries.date, fromDate),
						eq(mealPlanEntries.slot, fromSlot),
						eq(mealPlanEntries.course, fromCourse)
					)
				)
				.then((r) => r[0] ?? null),
			db
				.select()
				.from(mealPlanEntries)
				.where(
					and(
						eq(mealPlanEntries.familyId, familyId),
						eq(mealPlanEntries.date, toDate),
						eq(mealPlanEntries.slot, toSlot),
						eq(mealPlanEntries.course, toCourse)
					)
				)
				.then((r) => r[0] ?? null)
		]);

		if (!fromEntry) return fail(400, { message: 'Quell-Slot ist leer' });

		if (toEntry) {
			await Promise.all([
				db
					.update(mealPlanEntries)
					.set({ recipeId: toEntry.recipeId, freeText: toEntry.freeText, updatedBy: userName, updatedAt: new Date() })
					.where(eq(mealPlanEntries.id, fromEntry.id)),
				db
					.update(mealPlanEntries)
					.set({ recipeId: fromEntry.recipeId, freeText: fromEntry.freeText, updatedBy: userName, updatedAt: new Date() })
					.where(eq(mealPlanEntries.id, toEntry.id))
			]);
		} else {
			await db.insert(mealPlanEntries).values({
				familyId,
				date: toDate, slot: toSlot, course: toCourse,
				recipeId: fromEntry.recipeId, freeText: fromEntry.freeText,
				updatedBy: userName, updatedAt: new Date()
			});
			await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, fromEntry.id));
		}

		const action = toEntry ? 'getauscht' : 'verschoben';
		await db.insert(activityLog).values({
			familyId,
			logDate: today,
			userId: user.id,
			message: `${userName} hat ${formatDateLabel(fromDate)} ${SLOT_LABELS[fromSlot]} ${COURSE_LABELS[fromCourse] ?? ''} ${action} nach ${formatDateLabel(toDate)} ${SLOT_LABELS[toSlot]} ${COURSE_LABELS[toCourse] ?? ''}`,
			createdAt: new Date()
		});
	}
};
