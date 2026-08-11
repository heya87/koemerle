import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateMatchKeys } from '$lib/server/ingredients';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = Number(params.id);
	const [recipe] = await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.familyId, locals.user!.familyId)));
	if (!recipe) error(404, 'Rezept nicht gefunden');
	return { recipe };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401);

		const id = Number(params.id);
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const ingredients = formData.get('ingredients')?.toString().trim() ?? '';
		const recipeUrl = formData.get('recipeUrl')?.toString().trim() || null;
		const servingsRaw = formData.get('servings')?.toString().trim();
		const servings = servingsRaw ? Number(servingsRaw) : null;
		const courseRaw = formData.get('course')?.toString().trim() || null;
		const course = courseRaw === 'main' || courseRaw === 'side' ? courseRaw : null;
		const preparation = formData.get('preparation')?.toString().trim() || null;

		function parseNutrient(key: string): number | null {
			const raw = formData.get(key)?.toString().trim();
			const n = raw ? Number(raw) : NaN;
			return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
		}
		const kcal = parseNutrient('kcal');
		const fatG = parseNutrient('fat_g');
		const carbsG = parseNutrient('carbs_g');
		const proteinG = parseNutrient('protein_g');

		const failData = { name, ingredients, recipeUrl, servings, course, preparation, kcal, fatG, carbsG, proteinG };
		if (!name) return fail(400, { message: 'Name ist erforderlich.', ...failData });
		if (!ingredients) return fail(400, { message: 'Zutaten sind erforderlich.', ...failData });
		if (recipeUrl && !/^https?:\/\//i.test(recipeUrl)) return fail(400, { message: 'URL muss mit http:// oder https:// beginnen.', ...failData });

		const matchKeys = generateMatchKeys(ingredients);

		await db.update(recipes).set({ name, ingredients, matchKeys, recipeUrl, servings, course, preparation, kcal, fatG, carbsG, proteinG })
			.where(and(eq(recipes.id, id), eq(recipes.familyId, locals.user.familyId)));
		return redirect(303, '/recipes');
	}
};
