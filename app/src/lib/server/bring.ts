import { env } from '$env/dynamic/private';
import { getFamilyBringConfig, type BringConfig } from '$lib/server/families';
import type { Family } from '$lib/server/db/schema';

export type BringList = { id: string; name: string };

function envFallback() {
	return {
		email: env.BRING_EMAIL,
		password: env.BRING_PASSWORD,
		listId: env.BRING_LIST_ID,
		listName: env.BRING_LIST_NAME,
		listId2: env.BRING_LIST_ID_2,
		listName2: env.BRING_LIST_NAME_2
	};
}

/** Full Bring! config (email, decrypted password, lists) for a family, needed to actually send. */
export async function getBringConfig(family: Family): Promise<BringConfig> {
	return getFamilyBringConfig(family, envFallback());
}

/** Just the list id/name pairs, for display (e.g. the "which list?" picker). */
export async function getBringLists(family: Family): Promise<BringList[]> {
	const config = await getBringConfig(family);
	return config?.lists ?? [];
}
