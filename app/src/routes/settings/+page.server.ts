import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods, recipes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateMatchKeys } from '$lib/server/ingredients';

export const actions: Actions = {
	addGroup: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const label = fd.get('label')?.toString().trim();
		const keysRaw = fd.get('matchKeys')?.toString().trim();

		if (!label || !keysRaw) return fail(400, { message: 'Beide Felder erforderlich' });

		const matchKeys = keysRaw
			.split(',')
			.map((k) => k.trim().toLowerCase())
			.filter(Boolean);

		if (matchKeys.length < 2) return fail(400, { message: 'Mindestens 2 Schlüssel erforderlich' });

		await db.insert(ingredientGroups).values({ label, matchKeys });
	},

	deleteGroup: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const id = Number(fd.get('id')?.toString());
		if (!id) return fail(400);

		await db.delete(ingredientGroups).where(eq(ingredientGroups.id, id));
	},

	addPlantFood: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const matchKey = fd.get('matchKey')?.toString().trim().toLowerCase();
		const label = fd.get('label')?.toString().trim();

		if (!matchKey || !label) return fail(400, { message: 'Beide Felder erforderlich' });

		await db.insert(plantFoods).values({ matchKey, label }).onConflictDoNothing();
	},

	deletePlantFood: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const id = Number(fd.get('id')?.toString());
		if (!id) return fail(400);

		await db.delete(plantFoods).where(eq(plantFoods.id, id));
	},

	importRecipes: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const file = fd.get('file') as File | null;
		if (!file || file.size === 0) return fail(400, { message: 'Keine Datei ausgewählt' });

		let rows: unknown[];
		try {
			rows = JSON.parse(await file.text());
			if (!Array.isArray(rows)) throw new Error();
		} catch {
			return fail(400, { message: 'Ungültiges JSON-Format' });
		}

		let imported = 0;
		let skipped = 0;

		for (const row of rows) {
			if (typeof row !== 'object' || row === null) continue;
			const r = row as Record<string, unknown>;
			const name = typeof r.name === 'string' ? r.name.trim() : '';
			const ingredients = typeof r.ingredients === 'string' ? r.ingredients.trim() : '';
			if (!name || !ingredients) continue;

			const existing = await db.select().from(recipes).where(eq(recipes.name, name)).limit(1);
			if (existing.length > 0) { skipped++; continue; }

			const matchKeys = Array.isArray(r.matchKeys) ? r.matchKeys : generateMatchKeys(ingredients);
			await db.insert(recipes).values({
				name,
				ingredients,
				matchKeys,
				recipeUrl: typeof r.recipeUrl === 'string' ? r.recipeUrl || null : null,
				servings: typeof r.servings === 'number' ? r.servings : null,
				course: typeof r.course === 'string' ? r.course || null : null,
				kcal: typeof r.kcal === 'number' ? r.kcal : null,
				fatG: typeof r.fatG === 'number' ? r.fatG : null,
				carbsG: typeof r.carbsG === 'number' ? r.carbsG : null,
				proteinG: typeof r.proteinG === 'number' ? r.proteinG : null
			});
			imported++;
		}

		return { imported, skipped };
	}
};
