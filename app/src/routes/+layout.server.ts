import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods, ingredientListPrefs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CLAUDE_PROMPT } from '$lib/server/claude';
import { getBringLists } from '$lib/server/bring';
import { getFamily } from '$lib/server/families';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		return {
			user: null,
			ingredientGroups: [],
			plantFoods: [],
			claudePrompt: DEFAULT_CLAUDE_PROMPT,
			listPrefs: [],
			bringLists: [],
			family: null
		};
	}

	const familyId = event.locals.user.familyId;
	const family = await getFamily(familyId);
	if (!family) {
		// Should never happen (FK-enforced) — fail loudly rather than silently show empty data.
		throw new Error(`User ${event.locals.user.id} references missing family ${familyId}`);
	}

	const [groups, plantFoodRows, listPrefRows, bringLists] = await Promise.all([
		db.select().from(ingredientGroups).orderBy(ingredientGroups.label),
		db.select().from(plantFoods).orderBy(plantFoods.label),
		db.select().from(ingredientListPrefs).where(eq(ingredientListPrefs.familyId, familyId)).orderBy(ingredientListPrefs.matchKey),
		getBringLists(family)
	]);

	return {
		user: event.locals.user,
		ingredientGroups: groups,
		plantFoods: plantFoodRows,
		claudePrompt: family.claudePromptTemplate ?? DEFAULT_CLAUDE_PROMPT,
		listPrefs: listPrefRows,
		bringLists,
		family: {
			id: family.id,
			name: family.name,
			claudeEnabled: family.claudeEnabled,
			bringEmail: family.bringEmail ?? '',
			bringListId: family.bringListId ?? '',
			bringListName: family.bringListName ?? '',
			bringListId2: family.bringListId2 ?? '',
			bringListName2: family.bringListName2 ?? '',
			hasBringPassword: !!family.bringPasswordEnc,
			bioaboEmail: family.bioaboEmail ?? '',
			hasBioaboPassword: !!family.bioaboPasswordEnc
		}
	};
};
