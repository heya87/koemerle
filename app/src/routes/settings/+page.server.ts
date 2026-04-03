import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { ingredientSynonyms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const actions: Actions = {
	addSynonym: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const canonical = fd.get('canonical')?.toString().trim().toLowerCase();
		const alias = fd.get('alias')?.toString().trim().toLowerCase();

		if (!canonical || !alias) return fail(400, { message: 'Beide Felder erforderlich' });
		if (canonical === alias) return fail(400, { message: 'Alias darf nicht gleich wie Canonical sein' });

		await db
			.insert(ingredientSynonyms)
			.values({ canonical, alias })
			.onConflictDoNothing();
	},

	deleteSynonym: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const id = Number(fd.get('id')?.toString());
		if (!id) return fail(400);

		await db.delete(ingredientSynonyms).where(eq(ingredientSynonyms.id, id));
	}
};
