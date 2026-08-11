import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { lagerItems } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateBasketMatchKey } from '$lib/server/ingredients';

export const load: PageServerLoad = async ({ locals }) => {
	const familyId = locals.user!.familyId;
	const items = await db.select().from(lagerItems).where(eq(lagerItems.familyId, familyId)).orderBy(lagerItems.id);
	return { items };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const displayText = formData.get('displayText')?.toString().trim() ?? '';
		if (!displayText) return fail(400, { message: 'Bitte einen Eintrag eingeben.' });
		const matchKey = generateBasketMatchKey(displayText);
		await db.insert(lagerItems).values({ familyId: locals.user.familyId, displayText, matchKey });
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		await db.delete(lagerItems).where(and(eq(lagerItems.id, id), eq(lagerItems.familyId, locals.user.familyId)));
	}
};
