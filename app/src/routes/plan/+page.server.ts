import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems, mealPlanEntries, weekMeta, activityLog } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWeekStart, stripAccents } from '$lib/server/ingredients';

type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type Slot = 'lunch' | 'dinner';

const NOT_NEEDED = '__not_needed__';

const ALL_SLOTS: [Day, Slot][] = [
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

	const [allRecipes, basket, entries, metaRows] = await Promise.all([
		db.select().from(recipes).orderBy(recipes.name),
		db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
		db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart)),
		db.select().from(weekMeta).where(eq(weekMeta.weekStart, weekStart))
	]);

	return {
		weekStart,
		allRecipes,
		basket,
		entries,
		meta: metaRows[0] ?? null
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
		const [basket, allRecipes, existing] = await Promise.all([
			db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
			db.select().from(recipes),
			db.select().from(mealPlanEntries).where(eq(mealPlanEntries.weekStart, weekStart))
		]);

		const basketKeys = new Set(basket.map((b) => stripAccents(b.matchKey)));

		const scored = allRecipes
			.map((r) => ({ ...r, score: r.matchKeys.filter((k) => basketKeys.has(stripAccents(k))).length }))
			.filter((r) => r.score > 0)
			.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

		const usedIds = new Set(existing.map((e) => e.recipeId).filter((id) => id !== null));
		const available = scored.filter((r) => !usedIds.has(r.id));

		const startIdx = ALL_SLOTS.findIndex(([d, s]) => d === startDay && s === startSlot);

		type SuggestionEntry = {
			day: Day;
			slot: Slot;
			recipeId: number | null;
			recipeName: string | null;
			recipeUrl: string | null;
			notNeeded: boolean;
		};

		const suggestion: SuggestionEntry[] = [];

		for (const [day, slot] of ALL_SLOTS.slice(startIdx)) {
			if (existing.some((e) => e.day === day && e.slot === slot)) continue;

			if (notNeededKeys.has(`${day}-${slot}`)) {
				suggestion.push({ day, slot, recipeId: null, recipeName: null, recipeUrl: null, notNeeded: true });
				continue;
			}

			const recipe = available.shift();
			if (!recipe) continue; // leave empty rather than break, in case later slots have matches
			usedIds.add(recipe.id);
			suggestion.push({
				day,
				slot,
				recipeId: recipe.id,
				recipeName: recipe.name,
				recipeUrl: recipe.recipeUrl ?? null,
				notNeeded: false
			});
		}

		return { suggestion, startDay, startSlot };
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
	},

	moveSlot: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401);

		const fd = await request.formData();
		const fromDay = fd.get('fromDay')?.toString() as Day;
		const fromSlot = fd.get('fromSlot')?.toString() as Slot;
		const toDay = fd.get('toDay')?.toString() as Day;
		const toSlot = fd.get('toSlot')?.toString() as Slot;

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
