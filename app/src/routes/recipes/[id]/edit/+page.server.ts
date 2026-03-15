import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateMatchKeys } from '$lib/server/ingredients';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
	if (!recipe) error(404, 'Rezept nicht gefunden');
	return { recipe };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const id = Number(params.id);
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const ingredients = formData.get('ingredients')?.toString().trim() ?? '';
		const recipeUrl = formData.get('recipeUrl')?.toString().trim() || null;

		if (!name) return fail(400, { message: 'Name ist erforderlich.', name, ingredients, recipeUrl });
		if (!ingredients) return fail(400, { message: 'Zutaten sind erforderlich.', name, ingredients, recipeUrl });

		const matchKeys = generateMatchKeys(ingredients);

		await db.update(recipes).set({ name, ingredients, matchKeys, recipeUrl }).where(eq(recipes.id, id));
		return redirect(303, '/recipes');
	}
};
