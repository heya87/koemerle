import { fail } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	recipes,
	basketItems,
	lagerItems,
	mealPlanEntries,
	planMeta,
	ingredientGroups,
	ingredientListPrefs,
	shoppingSessions,
	shoppingItems
} from '$lib/server/db/schema';
import { eq, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { getWeekStart, buildAliasMap, createKeyNormalizer, stripQuantity } from '$lib/server/ingredients';
import { computeShoppingList } from '$lib/server/shopping';
import { getBringConfig, getBringLists } from '$lib/server/bring';
import { getFamily } from '$lib/server/families';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BringApi = createRequire(import.meta.url)('bring-shopping') as any;

async function generateItems(familyId: number, planStart: string, planEnd: string) {
	const weekStart = getWeekStart();
	const [basket, lager, groups] = await Promise.all([
		db.select().from(basketItems).where(and(eq(basketItems.familyId, familyId), eq(basketItems.weekStart, weekStart))),
		db.select().from(lagerItems).where(eq(lagerItems.familyId, familyId)),
		db.select().from(ingredientGroups)
	]);

	const entries = await db
		.select()
		.from(mealPlanEntries)
		.where(and(eq(mealPlanEntries.familyId, familyId), gte(mealPlanEntries.date, planStart), lte(mealPlanEntries.date, planEnd)));

	const recipeIds = entries.map((e) => e.recipeId).filter((id): id is number => id !== null);
	const [plannedRecipes, allRecipes] = await Promise.all([
		recipeIds.length > 0
			? db.select().from(recipes).where(and(eq(recipes.familyId, familyId), inArray(recipes.id, recipeIds)))
			: Promise.resolve([]),
		db.select({ id: recipes.id, name: recipes.name, ingredients: recipes.ingredients }).from(recipes).where(eq(recipes.familyId, familyId))
	]);

	const normalize = createKeyNormalizer(buildAliasMap(groups));
	const availableKeys = [...basket.map((b) => b.matchKey), ...lager.map((l) => l.matchKey)];
	const recipeById = new Map(plannedRecipes.map((r) => [r.id, r]));
	const items = computeShoppingList(
		recipeIds.map((id) => recipeById.get(id)?.ingredients ?? ''),
		availableKeys,
		allRecipes,
		normalize
	);

	return { items, planStart, planEnd };
}

export const load: PageServerLoad = async ({ locals }) => {
	const familyId = locals.user!.familyId;
	const family = await getFamily(familyId);

	const weekStart = getWeekStart();
	const [sessions, metaRows] = await Promise.all([
		db.select().from(shoppingSessions).where(and(eq(shoppingSessions.familyId, familyId), isNull(shoppingSessions.sentAt))).limit(1),
		db.select().from(planMeta).where(eq(planMeta.familyId, familyId)).limit(1)
	]);
	const session = sessions[0] ?? null;
	const meta = metaRows[0] ?? null;

	const rawItems = session
		? await db
				.select()
				.from(shoppingItems)
				.where(and(eq(shoppingItems.sessionId, session.id), eq(shoppingItems.excluded, false)))
		: [];

	const bringLists = family ? await getBringLists(family) : [];
	const prefs = rawItems.length > 0 ? await db.select().from(ingredientListPrefs).where(eq(ingredientListPrefs.familyId, familyId)) : [];
	const prefByKey = new Map(prefs.map((p) => [p.matchKey, p.listIndex]));
	const items = rawItems.map((item) => ({
		...item,
		preferredListId: bringLists[prefByKey.get(item.matchKey) ?? 0]?.id ?? null,
		lagerSuggestion: stripQuantity(item.displayText)
	}));

	return {
		weekStart,
		session,
		items,
		bringLists,
		defaultDates: meta ? { planStart: meta.planStart, planEnd: meta.planEnd } : null
	};
};

export const actions: Actions = {
	createSession: async ({ locals, request }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const formData = await request.formData();
		const planStart = formData.get('planStart') as string | null;
		const planEnd = formData.get('planEnd') as string | null;
		if (!planStart || !planEnd) return fail(400, { message: 'Datum fehlt.' });

		const generated = await generateItems(familyId, planStart, planEnd);

		// Remove any existing unsent sessions for this family
		const existing = await db
			.select()
			.from(shoppingSessions)
			.where(and(eq(shoppingSessions.familyId, familyId), isNull(shoppingSessions.sentAt)));
		for (const s of existing) {
			await db.delete(shoppingSessions).where(eq(shoppingSessions.id, s.id));
		}

		const [session] = await db
			.insert(shoppingSessions)
			.values({ familyId, planStart: generated.planStart, planEnd: generated.planEnd })
			.returning();

		if (generated.items.length > 0) {
			await db.insert(shoppingItems).values(
				generated.items.map((item) => ({
					familyId,
					sessionId: session.id,
					displayText: item.displayText,
					matchKey: item.matchKey
				}))
			);
		}

		return { created: true };
	},

	updateDates: async ({ locals, request }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		const planStart = formData.get('planStart') as string | null;
		const planEnd = formData.get('planEnd') as string | null;
		if (!sessionId || !planStart || !planEnd) return fail(400);

		const generated = await generateItems(familyId, planStart, planEnd);

		await db.delete(shoppingItems).where(and(eq(shoppingItems.sessionId, sessionId), eq(shoppingItems.familyId, familyId)));
		await db
			.update(shoppingSessions)
			.set({ planStart, planEnd })
			.where(and(eq(shoppingSessions.id, sessionId), eq(shoppingSessions.familyId, familyId)));

		if (generated.items.length > 0) {
			await db.insert(shoppingItems).values(
				generated.items.map((item) => ({
					familyId,
					sessionId,
					displayText: item.displayText,
					matchKey: item.matchKey
				}))
			);
		}

		return { updated: true };
	},

	excludeItem: async ({ locals, request }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const itemId = Number(formData.get('itemId'));
		if (!itemId) return fail(400);

		await db.update(shoppingItems).set({ excluded: true }).where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.familyId, locals.user.familyId)));
		return { excluded: itemId };
	},

	// "Already have this" — moves the item into the Vorratskammer (so future shopping
	// lists exclude it too) instead of buying it, and drops it from this session.
	moveToLager: async ({ locals, request }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const formData = await request.formData();
		const itemId = Number(formData.get('itemId'));
		const editedText = (formData.get('displayText') as string | null)?.trim();
		if (!itemId) return fail(400);

		const [item] = await db
			.select()
			.from(shoppingItems)
			.where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.familyId, familyId)));
		if (!item) return fail(404);

		await db.insert(lagerItems).values({
			familyId,
			displayText: editedText || stripQuantity(item.displayText),
			matchKey: item.matchKey
		});
		await db.update(shoppingItems).set({ excluded: true }).where(eq(shoppingItems.id, itemId));

		return { movedToLager: itemId };
	},

	discardSession: async ({ locals, request }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		if (!sessionId) return fail(400);

		await db.delete(shoppingSessions).where(and(eq(shoppingSessions.id, sessionId), eq(shoppingSessions.familyId, locals.user.familyId)));
		return { discarded: true };
	},

	sendToBring: async ({ locals, request }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const family = await getFamily(familyId);
		const bringConfig = family ? await getBringConfig(family) : null;
		if (!bringConfig) {
			return fail(400, { message: 'Bring! ist für eure Familie nicht eingerichtet (siehe Einstellungen).' });
		}
		const defaultListId = bringConfig.lists[0]?.id;
		if (!defaultListId) {
			return fail(400, { message: 'Keine Bring!-Liste konfiguriert (siehe Einstellungen).' });
		}

		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		const assignmentsJson = formData.get('assignments') as string | null;
		const assignments: Record<string, string> = assignmentsJson ? JSON.parse(assignmentsJson) : {};

		if (!sessionId) return fail(400);

		const items = await db
			.select()
			.from(shoppingItems)
			.where(and(eq(shoppingItems.sessionId, sessionId), eq(shoppingItems.familyId, familyId), eq(shoppingItems.excluded, false)));

		if (items.length === 0) {
			await db
				.update(shoppingSessions)
				.set({ sentAt: new Date() })
				.where(and(eq(shoppingSessions.id, sessionId), eq(shoppingSessions.familyId, familyId)));
			return { sent: 0 };
		}

		const byList: Record<string, string[]> = {};
		for (const item of items) {
			const listId = assignments[item.displayText] ?? defaultListId;
			if (!byList[listId]) byList[listId] = [];
			byList[listId].push(item.displayText);
		}

		try {
			const bring = new BringApi({ mail: bringConfig.email, password: bringConfig.password });
			await bring.login();

			let sent = 0;
			for (const [listId, itemNames] of Object.entries(byList)) {
				const existing = await bring.getItems(listId);
				const existingNames = new Set(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(existing.purchase ?? []).map((i: any) => i.name?.toLowerCase().trim())
				);
				for (const name of itemNames) {
					if (!existingNames.has(name.toLowerCase().trim())) {
						await bring.saveItem(listId, name, '');
						sent++;
					}
				}
			}

			// Learn from whichever list each ingredient actually went to, so the next
			// shopping list defaults to it without asking again.
			if (bringConfig.lists.length === 2) {
				await Promise.all(
					items.map((item) => {
						const listId = assignments[item.displayText] ?? defaultListId;
						const listIndex = bringConfig.lists.findIndex((l) => l.id === listId);
						if (listIndex === -1) return null;
						return db
							.insert(ingredientListPrefs)
							.values({ familyId, matchKey: item.matchKey, listIndex })
							.onConflictDoUpdate({ target: [ingredientListPrefs.familyId, ingredientListPrefs.matchKey], set: { listIndex } });
					})
				);
			}

			await db
				.update(shoppingSessions)
				.set({ sentAt: new Date() })
				.where(and(eq(shoppingSessions.id, sessionId), eq(shoppingSessions.familyId, familyId)));
			return { sent };
		} catch (e) {
			console.error('Bring! error:', e);
			return fail(500, { message: 'Fehler beim Senden an Bring!.' });
		}
	}
};
