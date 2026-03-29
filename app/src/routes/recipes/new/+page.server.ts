import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { generateMatchKeys } from '$lib/server/ingredients';

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const ingredients = formData.get('ingredients')?.toString().trim() ?? '';
		const recipeUrl = formData.get('recipeUrl')?.toString().trim() || null;
		const servingsRaw = formData.get('servings')?.toString().trim();
		const servings = servingsRaw ? Number(servingsRaw) : null;

		if (!name) return fail(400, { message: 'Name ist erforderlich.', name, ingredients, recipeUrl, servings });
		if (!ingredients) return fail(400, { message: 'Zutaten sind erforderlich.', name, ingredients, recipeUrl, servings });

		const matchKeys = generateMatchKeys(ingredients);

		await db.insert(recipes).values({ name, ingredients, matchKeys, recipeUrl, servings });
		return redirect(303, '/recipes');
	}
};
