import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems, mealPlanEntries, weekMeta, activityLog, ingredientGroups, plantFoods } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWeekStart, createKeyNormalizer, buildAliasMap } from '$lib/server/ingredients';
import { suggestPlan, ALL_SLOTS } from '$lib/server/planning';
import type { Day, Slot } from '$lib/server/planning';

const NOT_NEEDED = '__not_needed__';

const DAY_LABELS: Record<Day, string> = {
	monday: 'Montag',
	tuesday: 'Dienstag',
	wednesday: 'Mittwoch',
	thursday: 'Donnerstag',
	friday: 'Freitag',
	saturday: 'Samstag',
	sunday: 'Sonntag'
};

const SLOT_LABELS: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' };

const VALID_DAYS: Day[] = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday'
];

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();

	const [allRecipes, basket, entries, metaRows, groups, plantFoodRows] = await Promise.all([
		db.select().from(recipes).orderBy(recipes.name),
		db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
		db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart)),
		db.select().from(weekMeta).where(eq(weekMeta.weekStart, weekStart)),
		db.select().from(ingredientGroups),
		db.select().from(plantFoods)
	]);

	const normalize = createKeyNormalizer(buildAliasMap(groups));

	const plantKeySet = new Set(plantFoodRows.map((p) => normalize(p.matchKey)));
	const plantLabelMap = new Map(plantFoodRows.map((p) => [normalize(p.matchKey), p.label]));

	// Collect unique plant foods across all planned meals this week
	const foundPlants = new Map<string, string>(); // normalizedKey -> label
	for (const entry of entries) {
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

	return {
		weekStart,
		allRecipes,
		basket,
		entries,
		meta: metaRows[0] ?? null,
		plantCount: foundPlants.size,
		plantGoal: 30
	};
};

export const actions: Actions = {
	// Compute a suggestion and return it — no DB write.
	getSuggestion: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const startDay = fd.get('startDay')?.toString() as Day;
		const startSlot = fd.get('startSlot')?.toString() as Slot;
		const notNeededKeys = new Set(fd.getAll('notNeeded').map((v) => v.toString()));

		if (!VALID_DAYS.includes(startDay) || !['lunch', 'dinner'].includes(startSlot)) {
			return fail(400, { message: 'Ungültiger Start' });
		}


		const weekStart = getWeekStart();
		const [basket, allRecipes, existing, groups] = await Promise.all([
			db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
			db.select().from(recipes),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart)),
			db.select().from(ingredientGroups)
		]);

		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const basketKeys = new Set(basket.map((b) => normalize(b.matchKey)));
		const startIdx = ALL_SLOTS.findIndex(([d, s]) => d === startDay && s === startSlot);

		// Slots from startIdx that are marked not-needed will be cleared, so don't count
		// their current recipes as "used" — they should be available for other slots.
		const clearedSlotKeys = new Set(
			ALL_SLOTS.slice(startIdx)
				.map(([d, s]) => `${d}-${s}`)
				.filter((k) => notNeededKeys.has(k))
		);
		const usedIds = new Set(
			existing
				.filter((e) => !clearedSlotKeys.has(`${e.day}-${e.slot}`))
				.map((e) => e.recipeId)
				.filter((id): id is number => id !== null)
		);
		const occupiedSlotKeys = new Set(
			existing
				.filter((e) => !clearedSlotKeys.has(`${e.day}-${e.slot}`))
				.map((e) => `${e.day}-${e.slot}`)
		);

		const planned = suggestPlan({
			allRecipes,
			basketKeys,
			usedIds,
			occupiedSlotKeys,
			notNeededSlotKeys: notNeededKeys,
			slots: ALL_SLOTS.slice(startIdx),
			normalize
		});

		const recipeById = new Map(allRecipes.map((r) => [r.id, r]));
		const suggestion = planned.map((e) => ({
			...e,
			recipeName: e.recipeId ? (recipeById.get(e.recipeId)?.name ?? null) : null,
			recipeUrl: e.recipeId ? (recipeById.get(e.recipeId)?.recipeUrl ?? null) : null
		}));

		return { suggestion, startDay, startSlot };
	},

	// Compute a suggestion and save it directly — skips draft review.
	quickPlan: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const startDay = fd.get('startDay')?.toString() as Day;
		const startSlot = fd.get('startSlot')?.toString() as Slot;
		const notNeededKeys = new Set(fd.getAll('notNeeded').map((v) => v.toString()));

		if (!VALID_DAYS.includes(startDay) || !['lunch', 'dinner'].includes(startSlot)) {
			return fail(400, { message: 'Ungültiger Start' });
		}

		const weekStart = getWeekStart();
		const [basket, allRecipes, existing, groups] = await Promise.all([
			db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
			db.select().from(recipes),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart)),
			db.select().from(ingredientGroups)
		]);

		const normalize = createKeyNormalizer(buildAliasMap(groups));
		const basketKeys = new Set(basket.map((b) => normalize(b.matchKey)));
		const startIdx = ALL_SLOTS.findIndex(([d, s]) => d === startDay && s === startSlot);

		// Entries before startIdx are preserved as-is. Their recipes count as "used"
		// to avoid cross-boundary duplicates. Entries from startIdx onwards are fully
		// replaced — don't let the old plan exclude recipes from the new suggestion.
		const postStartKeys = new Set(ALL_SLOTS.slice(startIdx).map(([d, s]) => `${d}-${s}`));
		const preStartEntries = existing.filter((e) => !postStartKeys.has(`${e.day}-${e.slot}`));
		const usedIds = new Set(
			preStartEntries.map((e) => e.recipeId).filter((id): id is number => id !== null)
		);

		const newEntries = suggestPlan({
			allRecipes,
			basketKeys,
			usedIds,
			occupiedSlotKeys: new Set(),
			notNeededSlotKeys: notNeededKeys,
			slots: ALL_SLOTS.slice(startIdx),
			normalize
		});

		const userName = user.name ?? user.email;

		await db
			.insert(weekMeta)
			.values({ weekStart, planningStartDay: startDay, planningStartSlot: startSlot })
			.onConflictDoUpdate({
				target: weekMeta.weekStart,
				set: { planningStartDay: startDay, planningStartSlot: startSlot }
			});

		await db.delete(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart));

		const allEntries = [
			...preStartEntries.map((e) => ({
				weekStart,
				day: e.day,
				slot: e.slot,
				recipeId: e.recipeId,
				freeText: e.freeText,
				updatedBy: e.updatedBy,
				updatedAt: e.updatedAt
			})),
			...newEntries.map((e) => ({
				weekStart,
				day: e.day,
				slot: e.slot,
				recipeId: e.notNeeded ? null : (e.recipeId ?? null),
				freeText: e.notNeeded ? NOT_NEEDED : null,
				updatedBy: userName,
				updatedAt: new Date()
			}))
		];

		if (allEntries.length > 0) {
			await db.insert(mealPlanEntries).values(allEntries);
		}

		await db.insert(activityLog).values({
			weekStart,
			userId: user.id,
			message: `${userName} hat den Wochenplan neu erstellt`,
			createdAt: new Date()
		});
	},

	// Save the confirmed plan to DB.
	confirmPlan: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const startDay = fd.get('startDay')?.toString() as Day;
		const startSlot = fd.get('startSlot')?.toString() as Slot;
		const entriesJson = fd.get('entries')?.toString() ?? '[]';

		let entries: {
			day: Day;
			slot: Slot;
			recipeId: number | null;
			notNeeded: boolean;
		}[];
		try {
			entries = JSON.parse(entriesJson);
		} catch {
			return fail(400, { message: 'Ungültige Daten' });
		}

		const weekStart = getWeekStart();
		const userName = user.name ?? user.email;

		await db
			.insert(weekMeta)
			.values({ weekStart, planningStartDay: startDay, planningStartSlot: startSlot })
			.onConflictDoUpdate({
				target: weekMeta.weekStart,
				set: { planningStartDay: startDay, planningStartSlot: startSlot }
			});

		await db.delete(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart));

		if (entries.length > 0) {
			await db.insert(mealPlanEntries).values(
				entries.map((e) => ({
					weekStart,
					day: e.day,
					slot: e.slot,
					recipeId: e.notNeeded ? null : (e.recipeId ?? null),
					freeText: e.notNeeded ? NOT_NEEDED : null,
					updatedBy: userName,
					updatedAt: new Date()
				}))
			);
		}

		await db.insert(activityLog).values({
			weekStart,
			userId: user.id,
			message: `${userName} hat den Wochenplan bestätigt`,
			createdAt: new Date()
		});
	},

	setSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const day = fd.get('day')?.toString() as Day;
		const slot = fd.get('slot')?.toString() as Slot;

		if (!VALID_DAYS.includes(day) || !['lunch', 'dinner'].includes(slot)) {
			return fail(400, { message: 'Ungültiger Tag oder Slot' });
		}

		const recipeIdStr = fd.get('recipeId')?.toString();
		const freeText = fd.get('freeText')?.toString().trim() ?? '';

		const recipeId = recipeIdStr ? Number(recipeIdStr) : null;
		if (!recipeId && !freeText) return fail(400, { message: 'Rezept oder Text erforderlich' });

		const weekStart = getWeekStart();
		const userName = user.name ?? user.email;

		await db
			.insert(mealPlanEntries)
			.values({
				weekStart,
				day,
				slot,
				recipeId: recipeId ?? null,
				freeText: recipeId ? null : freeText,
				updatedBy: userName,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: [mealPlanEntries.weekStart, mealPlanEntries.day, mealPlanEntries.slot],
				set: {
					recipeId: recipeId ?? null,
					freeText: recipeId ? null : freeText,
					updatedBy: userName,
					updatedAt: new Date()
				}
			});

		await db.insert(activityLog).values({
			weekStart,
			userId: user.id,
			message: `${userName} hat ${DAY_LABELS[day]} ${SLOT_LABELS[slot]} geändert`,
			createdAt: new Date()
		});
	},

	clearSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const day = fd.get('day')?.toString() as Day;
		const slot = fd.get('slot')?.toString() as Slot;

		if (!VALID_DAYS.includes(day) || !['lunch', 'dinner'].includes(slot)) {
			return fail(400, { message: 'Ungültiger Tag oder Slot' });
		}

		const weekStart = getWeekStart();
		const userName = user.name ?? user.email;

		await db
			.delete(mealPlanEntries)
			.where(
				and(
					eq(mealPlanEntries.weekStart, weekStart),
					eq(mealPlanEntries.day, day),
					eq(mealPlanEntries.slot, slot)
				)
			);

		await db.insert(activityLog).values({
			weekStart,
			userId: user.id,
			message: `${userName} hat ${DAY_LABELS[day]} ${SLOT_LABELS[slot]} geleert`,
			createdAt: new Date()
		});
	},

	moveSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const fromDay = fd.get('fromDay')?.toString() as Day;
		const fromSlot = fd.get('fromSlot')?.toString() as Slot;
		const toDay = fd.get('toDay')?.toString() as Day;
		const toSlot = fd.get('toSlot')?.toString() as Slot;

		if (
			!VALID_DAYS.includes(fromDay) || !['lunch', 'dinner'].includes(fromSlot) ||
			!VALID_DAYS.includes(toDay) || !['lunch', 'dinner'].includes(toSlot)
		) {
			return fail(400, { message: 'Ungültiger Tag oder Slot' });
		}

		if (fromDay === toDay && fromSlot === toSlot) return;

		const weekStart = getWeekStart();
		const userName = user.name ?? user.email;

		const [fromEntry, toEntry] = await Promise.all([
			db
				.select()
				.from(mealPlanEntries)
				.where(
					and(
						eq(mealPlanEntries.weekStart, weekStart),
						eq(mealPlanEntries.day, fromDay),
						eq(mealPlanEntries.slot, fromSlot)
					)
				)
				.then((r) => r[0] ?? null),
			db
				.select()
				.from(mealPlanEntries)
				.where(
					and(
						eq(mealPlanEntries.weekStart, weekStart),
						eq(mealPlanEntries.day, toDay),
						eq(mealPlanEntries.slot, toSlot)
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
				weekStart, day: toDay, slot: toSlot,
				recipeId: fromEntry.recipeId, freeText: fromEntry.freeText,
				updatedBy: userName, updatedAt: new Date()
			});
			await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, fromEntry.id));
		}

		const action = toEntry ? 'getauscht' : 'verschoben';
		await db.insert(activityLog).values({
			weekStart,
			userId: user.id,
			message: `${userName} hat ${DAY_LABELS[fromDay]} ${SLOT_LABELS[fromSlot]} ${action} nach ${DAY_LABELS[toDay]} ${SLOT_LABELS[toSlot]}`,
			createdAt: new Date()
		});
	}
};
