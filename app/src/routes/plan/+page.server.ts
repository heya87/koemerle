import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems, mealPlanEntries, planMeta, activityLog, ingredientGroups, plantFoods } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getWeekStart, createKeyNormalizer, buildAliasMap } from '$lib/server/ingredients';
import { suggestPlan, generateSlots } from '$lib/server/planning';
import type { Slot, Course } from '$lib/server/planning';

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

export const load: PageServerLoad = async () => {
	const today = new Date().toISOString().split('T')[0];
	const weekStart = getWeekStart();

	const [allRecipes, basket, entries, metaRows, groups, plantFoodRows] = await Promise.all([
		db.select().from(recipes).orderBy(recipes.name),
		db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
		db.select().from(mealPlanEntries),
		db.select().from(planMeta).limit(1),
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

	return {
		today,
		allRecipes,
		basket,
		entries,
		meta,
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
			db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
			db.select().from(recipes),
			db.select().from(mealPlanEntries),
			db.select().from(ingredientGroups)
		]);

		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const basketKeys = new Set(basket.map((b) => normalize(b.matchKey)));
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
			basketKeys,
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

		const fd = await request.formData();
		const startDate = fd.get('startDate')?.toString() ?? '';
		const endDate = fd.get('endDate')?.toString() ?? '';
		const startSlot = (fd.get('startSlot')?.toString() ?? 'lunch') as Slot;

		if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
			return fail(400, { message: 'Ungültige Datumsangaben' });
		}

		const weekStart = getWeekStart();
		const [basket, allRecipes, existing, groups] = await Promise.all([
			db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
			db.select().from(recipes),
			db.select().from(mealPlanEntries),
			db.select().from(ingredientGroups)
		]);

		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const basketKeys = new Set(basket.map((b) => normalize(b.matchKey)));
		const notNeededKeys = new Set(fd.getAll('notNeeded').map((v) => v.toString()));
		const allSlots = generateSlots(startDate, endDate, startSlot);
		const allSlotKeys = new Set(allSlots.map(([d, s]) => `${d}-${s}`));

		const outsideEntries = existing.filter((e) => !allSlotKeys.has(`${e.date}-${e.slot}`));
		const usedIds = new Set(
			outsideEntries.map((e) => e.recipeId).filter((id): id is number => id !== null)
		);

		const newEntries = suggestPlan({
			allRecipes,
			basketKeys,
			usedIds,
			occupiedKeys: new Set(),
			notNeededSlotKeys: notNeededKeys,
			slots: allSlots,
			normalize
		});

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		await db.delete(planMeta);
		await db.insert(planMeta).values({ planStart: startDate, planEnd: endDate, planningStartSlot: startSlot });

		await db.delete(mealPlanEntries).where(
			and(gte(mealPlanEntries.date, startDate), lte(mealPlanEntries.date, endDate))
		);

		if (newEntries.length > 0) {
			await db.insert(mealPlanEntries).values(
				newEntries.map((e) => ({
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

		const fd = await request.formData();
		const startDate = fd.get('startDate')?.toString() ?? '';
		const endDate = fd.get('endDate')?.toString() ?? '';
		const startSlot = fd.get('startSlot')?.toString() ?? 'lunch';
		const entriesJson = fd.get('entries')?.toString() ?? '[]';

		if (!isValidDate(startDate) || !isValidDate(endDate)) {
			return fail(400, { message: 'Ungültige Datumsangaben' });
		}

		let entries: {
			date: string;
			slot: Slot;
			course: Course;
			recipeId: number | null;
			notNeeded: boolean;
		}[];
		try {
			entries = JSON.parse(entriesJson);
		} catch {
			return fail(400, { message: 'Ungültige Daten' });
		}

		const userName = user.name ?? user.email;
		const today = new Date().toISOString().split('T')[0];

		await db.delete(planMeta);
		await db.insert(planMeta).values({ planStart: startDate, planEnd: endDate, planningStartSlot: startSlot });

		await db.delete(mealPlanEntries).where(
			and(gte(mealPlanEntries.date, startDate), lte(mealPlanEntries.date, endDate))
		);

		if (entries.length > 0) {
			await db.insert(mealPlanEntries).values(
				entries.map((e) => ({
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

		await db.insert(activityLog).values({
			logDate: today,
			userId: user.id,
			message: `${userName} hat den Plan bestätigt`,
			createdAt: new Date()
		});
	},

	setSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

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
				date,
				slot,
				course,
				recipeId: recipeId ?? null,
				freeText: recipeId ? null : freeText,
				updatedBy: userName,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: [mealPlanEntries.date, mealPlanEntries.slot, mealPlanEntries.course],
				set: {
					recipeId: recipeId ?? null,
					freeText: recipeId ? null : freeText,
					updatedBy: userName,
					updatedAt: new Date()
				}
			});

		await db.insert(activityLog).values({
			logDate: today,
			userId: user.id,
			message: `${userName} hat ${formatDateLabel(date)} ${SLOT_LABELS[slot]} ${COURSE_LABELS[course] ?? ''} geändert`,
			createdAt: new Date()
		});
	},

	clearSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

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
					eq(mealPlanEntries.date, date),
					eq(mealPlanEntries.slot, slot),
					eq(mealPlanEntries.course, course)
				)
			);

		await db.insert(activityLog).values({
			logDate: today,
			userId: user.id,
			message: `${userName} hat ${formatDateLabel(date)} ${SLOT_LABELS[slot]} ${COURSE_LABELS[course] ?? ''} geleert`,
			createdAt: new Date()
		});
	},

	moveSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

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
				date: toDate, slot: toSlot, course: toCourse,
				recipeId: fromEntry.recipeId, freeText: fromEntry.freeText,
				updatedBy: userName, updatedAt: new Date()
			});
			await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, fromEntry.id));
		}

		const action = toEntry ? 'getauscht' : 'verschoben';
		await db.insert(activityLog).values({
			logDate: today,
			userId: user.id,
			message: `${userName} hat ${formatDateLabel(fromDate)} ${SLOT_LABELS[fromSlot]} ${COURSE_LABELS[fromCourse] ?? ''} ${action} nach ${formatDateLabel(toDate)} ${SLOT_LABELS[toSlot]} ${COURSE_LABELS[toCourse] ?? ''}`,
			createdAt: new Date()
		});
	}
};
