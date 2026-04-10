import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes, basketItems } from '$lib/server/db/schema';
import { searchFooby, fetchFoobyRecipe } from '$lib/server/fooby';
import { generateMatchKeys, getWeekStart } from '$lib/server/ingredients';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const weekStart = getWeekStart();
	const basket = await db
		.select()
		.from(basketItems)
		.where(eq(basketItems.weekStart, weekStart))
		.orderBy(basketItems.id);
	return { basket };
};

export const actions: Actions = {
	search: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const query = formData.get('query')?.toString().trim() ?? '';
		if (!query) return fail(400, { message: 'Suchbegriff eingeben' });

		try {
			const results = await searchFooby(query);
			return { results, query };
		} catch {
			return fail(500, { message: 'Fooby-Suche fehlgeschlagen' });
		}
	},

	preview: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const url = formData.get('url')?.toString() ?? '';
		const query = formData.get('query')?.toString() ?? '';

		// Re-fetch search results so the left panel stays populated
		let results = [];
		if (query) {
			try {
				results = await searchFooby(query);
			} catch {
				// ignore — left panel just stays empty
			}
		}

		try {
			const preview = await fetchFoobyRecipe(url);
			return { results, query, preview };
		} catch (e) {
			console.error('fetchFoobyRecipe error:', e);
			return fail(500, { message: String(e), results, query });
		}
	},

	save: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const ingredients = formData.get('ingredients')?.toString().trim() ?? '';
		const recipeUrl = formData.get('recipeUrl')?.toString().trim() || null;

		if (!name) return fail(400, { message: 'Name fehlt' });
		if (!ingredients) return fail(400, { message: 'Zutaten fehlen' });

		function parseN(key: string): number | null {
			const raw = formData.get(key)?.toString().trim();
			const n = raw ? Number(raw) : NaN;
			return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
		}
		const kcal = parseN('kcal');
		const fatG = parseN('fat_g');
		const carbsG = parseN('carbs_g');
		const proteinG = parseN('protein_g');

		const matchKeys = generateMatchKeys(ingredients);
		await db.insert(recipes).values({ name, ingredients, matchKeys, recipeUrl, kcal, fatG, carbsG, proteinG });
		return redirect(303, '/recipes');
	}
};
