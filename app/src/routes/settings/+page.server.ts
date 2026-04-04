import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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
	}
};
