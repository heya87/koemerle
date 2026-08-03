import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods, cronRuns, siteSettings, ingredientListPrefs } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { DEFAULT_CLAUDE_PROMPT } from '$lib/server/claude';
import { getBringLists } from '$lib/server/bring';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		return {
			user: null,
			ingredientGroups: [],
			plantFoods: [],
			cronRuns: [],
			claudePrompt: DEFAULT_CLAUDE_PROMPT,
			listPrefs: [],
			bringLists: []
		};
	}
	const [groups, plantFoodRows, cronRunRows, settingsRows, listPrefRows] = await Promise.all([
		db.select().from(ingredientGroups).orderBy(ingredientGroups.label),
		db.select().from(plantFoods).orderBy(plantFoods.label),
		db.select().from(cronRuns).orderBy(desc(cronRuns.ranAt)).limit(50),
		db.select().from(siteSettings).limit(1),
		db.select().from(ingredientListPrefs).orderBy(ingredientListPrefs.matchKey)
	]);
	return {
		user: event.locals.user,
		ingredientGroups: groups,
		plantFoods: plantFoodRows,
		cronRuns: cronRunRows,
		claudePrompt: settingsRows[0]?.claudePromptTemplate ?? DEFAULT_CLAUDE_PROMPT,
		listPrefs: listPrefRows,
		bringLists: getBringLists()
	};
};
