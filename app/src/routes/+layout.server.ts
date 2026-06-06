import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods, cronRuns } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) return { user: null, ingredientGroups: [], plantFoods: [], cronRuns: [] };
	const [groups, plantFoodRows, cronRunRows] = await Promise.all([
		db.select().from(ingredientGroups).orderBy(ingredientGroups.label),
		db.select().from(plantFoods).orderBy(plantFoods.label),
		db.select().from(cronRuns).orderBy(desc(cronRuns.ranAt)).limit(50)
	]);
	return { user: event.locals.user, ingredientGroups: groups, plantFoods: plantFoodRows, cronRuns: cronRunRows };
};
