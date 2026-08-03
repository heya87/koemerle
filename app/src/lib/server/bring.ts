import { env } from '$env/dynamic/private';

export type BringList = { id: string; name: string };

/**
 * The two configured Bring! lists, in a stable order (index 0 / 1).
 * ingredientListPrefs.listIndex refers to this order, not a raw list id,
 * since which env-configured list is which can change per deployment.
 */
export function getBringLists(): BringList[] {
	const { BRING_LIST_ID, BRING_LIST_NAME, BRING_LIST_ID_2, BRING_LIST_NAME_2 } = env;
	return BRING_LIST_ID && BRING_LIST_ID_2
		? [
				{ id: BRING_LIST_ID, name: BRING_LIST_NAME || 'Liste 1' },
				{ id: BRING_LIST_ID_2, name: BRING_LIST_NAME_2 || 'Liste 2' }
			]
		: [];
}
