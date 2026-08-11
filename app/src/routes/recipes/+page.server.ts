import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const familyId = locals.user!.familyId;
	const all = await db.select().from(recipes).where(and(eq(recipes.familyId, familyId), eq(recipes.transient, false))).orderBy(recipes.name);
	return { recipes: all };
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { message: 'Ungültige ID' });

		await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.familyId, locals.user.familyId)));
		return redirect(303, '/recipes');
	}
};
