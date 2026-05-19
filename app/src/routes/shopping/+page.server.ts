import { fail } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	recipes,
	basketItems,
	fridgeItems,
	mealPlanEntries,
	planMeta,
	ingredientGroups,
	shoppingSessions,
	shoppingItems
} from '$lib/server/db/schema';
import { eq, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { getWeekStart, buildAliasMap, createKeyNormalizer } from '$lib/server/ingredients';
import { computeShoppingList } from '$lib/server/shopping';
import { env } from '$env/dynamic/private';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BringApi = createRequire(import.meta.url)('bring-shopping') as any;

function getBringLists() {
	const { BRING_LIST_ID, BRING_LIST_NAME, BRING_LIST_ID_2, BRING_LIST_NAME_2 } = env;
	return BRING_LIST_ID && BRING_LIST_ID_2
		? [
				{ id: BRING_LIST_ID, name: BRING_LIST_NAME || 'Liste 1' },
				{ id: BRING_LIST_ID_2, name: BRING_LIST_NAME_2 || 'Liste 2' }
			]
		: [];
}

async function generateItems(planStart: string, planEnd: string) {
	const weekStart = getWeekStart();
	const [basket, fridge, groups] = await Promise.all([
		db.select().from(basketItems).where(eq(basketItems.weekStart, weekStart)),
		db.select().from(fridgeItems),
		db.select().from(ingredientGroups)
	]);

	const entries = await db
		.select()
		.from(mealPlanEntries)
		.where(and(gte(mealPlanEntries.date, planStart), lte(mealPlanEntries.date, planEnd)));

	const recipeIds = entries.map((e) => e.recipeId).filter((id): id is number => id !== null);
	const [plannedRecipes, allRecipes] = await Promise.all([
		recipeIds.length > 0
			? db.select().from(recipes).where(inArray(recipes.id, recipeIds))
			: Promise.resolve([]),
		db.select({ name: recipes.name, ingredients: recipes.ingredients }).from(recipes)
	]);

	const normalize = createKeyNormalizer(buildAliasMap(groups));
	const availableKeys = [...basket.map((b) => b.matchKey), ...fridge.map((f) => f.matchKey)];
	const recipeById = new Map(plannedRecipes.map((r) => [r.id, r]));
	const items = computeShoppingList(
		recipeIds.map((id) => recipeById.get(id)?.ingredients ?? ''),
		availableKeys,
		allRecipes,
		normalize
	);

	return { items, planStart, planEnd };
}

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();
	const [sessions, metaRows] = await Promise.all([
		db.select().from(shoppingSessions).where(isNull(shoppingSessions.sentAt)).limit(1),
		db.select().from(planMeta).limit(1)
	]);
	const session = sessions[0] ?? null;
	const meta = metaRows[0] ?? null;

	const items = session
		? await db
				.select()
				.from(shoppingItems)
				.where(and(eq(shoppingItems.sessionId, session.id), eq(shoppingItems.excluded, false)))
		: [];

	return {
		weekStart,
		session,
		items,
		bringLists: getBringLists(),
		defaultDates: meta ? { planStart: meta.planStart, planEnd: meta.planEnd } : null
	};
};

export const actions: Actions = {
	createSession: async ({ locals, request }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const planStart = formData.get('planStart') as string | null;
		const planEnd = formData.get('planEnd') as string | null;
		if (!planStart || !planEnd) return fail(400, { message: 'Datum fehlt.' });

		const generated = await generateItems(planStart, planEnd);

		// Remove any existing unsent sessions
		const existing = await db
			.select()
			.from(shoppingSessions)
			.where(isNull(shoppingSessions.sentAt));
		for (const s of existing) {
			await db.delete(shoppingSessions).where(eq(shoppingSessions.id, s.id));
		}

		const [session] = await db
			.insert(shoppingSessions)
			.values({ planStart: generated.planStart, planEnd: generated.planEnd })
			.returning();

		if (generated.items.length > 0) {
			await db.insert(shoppingItems).values(
				generated.items.map((item) => ({
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

		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		const planStart = formData.get('planStart') as string | null;
		const planEnd = formData.get('planEnd') as string | null;
		if (!sessionId || !planStart || !planEnd) return fail(400);

		const generated = await generateItems(planStart, planEnd);

		await db.delete(shoppingItems).where(eq(shoppingItems.sessionId, sessionId));
		await db
			.update(shoppingSessions)
			.set({ planStart, planEnd })
			.where(eq(shoppingSessions.id, sessionId));

		if (generated.items.length > 0) {
			await db.insert(shoppingItems).values(
				generated.items.map((item) => ({
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

		await db.update(shoppingItems).set({ excluded: true }).where(eq(shoppingItems.id, itemId));
		return { excluded: itemId };
	},

	discardSession: async ({ locals, request }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		if (!sessionId) return fail(400);

		await db.delete(shoppingSessions).where(eq(shoppingSessions.id, sessionId));
		return { discarded: true };
	},

	sendToBring: async ({ locals, request }) => {
		if (!locals.user) return fail(401);

		const { BRING_EMAIL, BRING_PASSWORD, BRING_LIST_ID } = env;
		if (!BRING_EMAIL || !BRING_PASSWORD) {
			return fail(400, { message: 'Bring! Zugangsdaten fehlen (BRING_EMAIL / BRING_PASSWORD).' });
		}
		if (!BRING_LIST_ID) {
			return fail(400, { message: 'BRING_LIST_ID fehlt in den Umgebungsvariablen.' });
		}

		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		const assignmentsJson = formData.get('assignments') as string | null;
		const assignments: Record<string, string> = assignmentsJson ? JSON.parse(assignmentsJson) : {};

		if (!sessionId) return fail(400);

		const items = await db
			.select()
			.from(shoppingItems)
			.where(and(eq(shoppingItems.sessionId, sessionId), eq(shoppingItems.excluded, false)));

		if (items.length === 0) {
			await db
				.update(shoppingSessions)
				.set({ sentAt: new Date() })
				.where(eq(shoppingSessions.id, sessionId));
			return { sent: 0 };
		}

		const byList: Record<string, string[]> = {};
		for (const item of items) {
			const listId = assignments[item.displayText] ?? BRING_LIST_ID;
			if (!byList[listId]) byList[listId] = [];
			byList[listId].push(item.displayText);
		}

		try {
			const bring = new BringApi({ mail: BRING_EMAIL, password: BRING_PASSWORD });
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

			await db
				.update(shoppingSessions)
				.set({ sentAt: new Date() })
				.where(eq(shoppingSessions.id, sessionId));
			return { sent };
		} catch (e) {
			console.error('Bring! error:', e);
			return fail(500, { message: 'Fehler beim Senden an Bring!.' });
		}
	}
};
