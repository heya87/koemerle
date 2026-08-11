import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	const all = await db.select().from(recipes).where(eq(recipes.familyId, locals.user.familyId)).orderBy(recipes.name);
	const exportData = all.map(({ id, familyId, createdAt, ...rest }) => rest);

	return new Response(JSON.stringify(exportData, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': 'attachment; filename="rezepte.json"'
		}
	});
};
