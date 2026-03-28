import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems, mealPlanEntries, weekMeta, activityLog } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWeekStart } from '$lib/server/ingredients';

type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type Slot = 'lunch' | 'dinner';

// All valid slots in planning order. Thursday has no lunch.
const ALL_SLOTS: [Day, Slot][] = [
	['monday', 'lunch'],
	['monday', 'dinner'],
	['tuesday', 'lunch'],
	['tuesday', 'dinner'],
	['wednesday', 'lunch'],
	['wednesday', 'dinner'],
	['thursday', 'dinner'],
	['friday', 'lunch'],
	['friday', 'dinner'],
	['saturday', 'lunch'],
	['saturday', 'dinner'],
	['sunday', 'lunch'],
	['sunday', 'dinner']
];

const DAY_LABELS: Record<Day, string> = {
	monday: 'Montag',
	tuesday: 'Dienstag',
	wednesday: 'Mittwoch',
	thursday: 'Donnerstag',
	friday: 'Freitag',
	saturday: 'Samstag',
	sunday: 'Sonntag'
};

const SLOT_LABELS: Record<Slot, string> = {
	lunch: 'Mittag',
	dinner: 'Abend'
};

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();

	const [allRecipes, basket, entries, metaRows] = await Promise.all([
		db.select().from(recipes).orderBy(recipes.name),
		db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
		db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart)),
		db
			.select()
			.from(weekMeta)
			.where(eq(weekMeta.weekStart, weekStart))
	]);

	const meta = metaRows[0] ?? null;

	// Compute basket match key set for display purposes
	const basketKeys = basket.map((b) => b.matchKey);

	return { weekStart, allRecipes, basket, basketKeys, entries, meta };
};

export const actions: Actions = {
	startPlanning: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const startDay = fd.get('startDay')?.toString() as Day;
		const startSlot = fd.get('startSlot')?.toString() as Slot;

		const validDays: Day[] = [
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
			'sunday'
		];
		if (!validDays.includes(startDay) || !['lunch', 'dinner'].includes(startSlot)) {
			return fail(400, { message: 'Ungültiger Start' });
		}
		if (startDay === 'thursday' && startSlot === 'lunch') {
			return fail(400, { message: 'Donnerstag hat kein Mittagessen' });
		}

		const weekStart = getWeekStart();
		const userName = user.name ?? user.email;

		// Get basket keys and recipes
		const [basket, allRecipes, existing] = await Promise.all([
			db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
			db.select().from(recipes),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart))
		]);

		const basketKeys = new Set(basket.map((b) => b.matchKey));

		// Score and sort recipes by basket match count
		const scored = allRecipes
			.map((r) => ({
				...r,
				score: r.matchKeys.filter((k) => basketKeys.has(k)).length
			}))
			.filter((r) => r.score > 0)
			.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

		const usedRecipeIds = new Set(existing.map((e) => e.recipeId).filter((id) => id !== null));
		const available = scored.filter((r) => !usedRecipeIds.has(r.id));

		// Find starting slot index
		const startIdx = ALL_SLOTS.findIndex(([d, s]) => d === startDay && s === startSlot);
		const slotsToFill = ALL_SLOTS.slice(startIdx);

		// Build new entries for unfilled slots
		const toInsert: (typeof mealPlanEntries.$inferInsert)[] = [];
		for (const [day, slot] of slotsToFill) {
			if (existing.some((e) => e.day === day && e.slot === slot)) continue;
			const recipe = available.shift();
			if (!recipe) break;
			usedRecipeIds.add(recipe.id);
			toInsert.push({
				weekStart,
				day,
				slot,
				recipeId: recipe.id,
				freeText: null,
				updatedBy: userName,
				updatedAt: new Date()
			});
		}

		// Save meta and entries
		await db
			.insert(weekMeta)
			.values({ weekStart, planningStartDay: startDay, planningStartSlot: startSlot })
			.onConflictDoUpdate({
				target: weekMeta.weekStart,
				set: { planningStartDay: startDay, planningStartSlot: startSlot }
			});

		if (toInsert.length > 0) {
			await db.insert(mealPlanEntries).values(toInsert);
		}

		await db.insert(activityLog).values({
			weekStart,
			userId: user.id,
			message: `${userName} hat die Planung gestartet (ab ${DAY_LABELS[startDay]} ${SLOT_LABELS[startSlot]})`,
			createdAt: new Date()
		});
	},

	setSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const day = fd.get('day')?.toString() as Day;
		const slot = fd.get('slot')?.toString() as Slot;
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
	}
};
