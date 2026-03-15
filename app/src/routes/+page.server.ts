import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const tasks = await db.select().from(task);
	return { tasks };
};
