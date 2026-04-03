import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ingredientSynonyms } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async (event) => {
	const synonyms = event.locals.user
		? await db.select().from(ingredientSynonyms).orderBy(ingredientSynonyms.canonical)
		: [];
	return { user: event.locals.user, synonyms };
};
