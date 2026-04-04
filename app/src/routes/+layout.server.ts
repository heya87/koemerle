import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) return { user: null, ingredientGroups: [], plantFoods: [] };
	const [groups, plantFoodRows] = await Promise.all([
		db.select().from(ingredientGroups).orderBy(ingredientGroups.label),
		db.select().from(plantFoods).orderBy(plantFoods.label)
	]);
	return { user: event.locals.user, ingredientGroups: groups, plantFoods: plantFoodRows };
};
