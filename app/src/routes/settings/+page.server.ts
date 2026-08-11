import { fail } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { ingredientGroups, plantFoods, recipes, ingredientListPrefs, families } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateMatchKeys } from '$lib/server/ingredients';
import { encryptSecret, decryptSecret } from '$lib/server/crypto';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BringApi = createRequire(import.meta.url)('bring-shopping') as any;

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

	editGroup: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const id = Number(fd.get('id')?.toString());
		const field = fd.get('field')?.toString();
		const value = fd.get('value')?.toString().trim() ?? '';
		if (!id || !value) return fail(400);

		if (field === 'label') {
			await db.update(ingredientGroups).set({ label: value }).where(eq(ingredientGroups.id, id));
		} else if (field === 'matchKeys') {
			const matchKeys = value.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
			if (matchKeys.length < 2) return fail(400, { message: 'Mindestens 2 Schlüssel erforderlich' });
			await db.update(ingredientGroups).set({ matchKeys }).where(eq(ingredientGroups.id, id));
		}
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
	},

	importRecipes: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const fd = await request.formData();
		const file = fd.get('file') as File | null;
		if (!file || file.size === 0) return fail(400, { message: 'Keine Datei ausgewählt' });

		let rows: unknown[];
		try {
			rows = JSON.parse(await file.text());
			if (!Array.isArray(rows)) throw new Error();
		} catch {
			return fail(400, { message: 'Ungültiges JSON-Format' });
		}

		let imported = 0;
		let skipped = 0;

		for (const row of rows) {
			if (typeof row !== 'object' || row === null) continue;
			const r = row as Record<string, unknown>;
			const name = typeof r.name === 'string' ? r.name.trim() : '';
			const ingredients = typeof r.ingredients === 'string' ? r.ingredients.trim() : '';
			if (!name || !ingredients) continue;

			const existing = await db.select().from(recipes).where(and(eq(recipes.familyId, familyId), eq(recipes.name, name))).limit(1);
			if (existing.length > 0) { skipped++; continue; }

			const matchKeys = Array.isArray(r.matchKeys) ? r.matchKeys : generateMatchKeys(ingredients);
			await db.insert(recipes).values({
				familyId,
				name,
				ingredients,
				matchKeys,
				recipeUrl: typeof r.recipeUrl === 'string' ? r.recipeUrl || null : null,
				servings: typeof r.servings === 'number' ? r.servings : null,
				course: typeof r.course === 'string' ? r.course || null : null,
				kcal: typeof r.kcal === 'number' ? r.kcal : null,
				fatG: typeof r.fatG === 'number' ? r.fatG : null,
				carbsG: typeof r.carbsG === 'number' ? r.carbsG : null,
				proteinG: typeof r.proteinG === 'number' ? r.proteinG : null
			});
			imported++;
		}

		return { imported, skipped };
	},

	saveClaudePrompt: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const template = fd.get('template')?.toString() ?? '';
		if (!template.trim()) return fail(400, { message: 'Prompt darf nicht leer sein.' });

		await db.update(families).set({ claudePromptTemplate: template }).where(eq(families.id, locals.user.familyId));

		return { savedPrompt: true };
	},

	resetClaudePrompt: async ({ locals }) => {
		if (!locals.user) return fail(401);

		await db.update(families).set({ claudePromptTemplate: null }).where(eq(families.id, locals.user.familyId));
		return { savedPrompt: true };
	},

	setListPref: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const fd = await request.formData();
		const matchKey = fd.get('matchKey')?.toString().trim().toLowerCase();
		const listIndex = Number(fd.get('listIndex'));

		if (!matchKey || ![0, 1].includes(listIndex)) return fail(400, { message: 'Zutat und Liste erforderlich' });

		await db
			.insert(ingredientListPrefs)
			.values({ familyId, matchKey, listIndex })
			.onConflictDoUpdate({ target: [ingredientListPrefs.familyId, ingredientListPrefs.matchKey], set: { listIndex } });
	},

	deleteListPref: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const familyId = locals.user.familyId;

		const fd = await request.formData();
		const id = Number(fd.get('id')?.toString());
		if (!id) return fail(400);

		await db.delete(ingredientListPrefs).where(and(eq(ingredientListPrefs.id, id), eq(ingredientListPrefs.familyId, familyId)));
	},

	renameFamily: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const name = fd.get('name')?.toString().trim();
		if (!name) return fail(400, { message: 'Name darf nicht leer sein.' });

		await db.update(families).set({ name }).where(eq(families.id, locals.user.familyId));
		return { savedFamily: true };
	},

	saveBring: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const email = fd.get('email')?.toString().trim() || null;
		const password = fd.get('password')?.toString().trim();
		const listId = fd.get('listId')?.toString().trim() || null;
		const listName = fd.get('listName')?.toString().trim() || null;
		const listId2 = fd.get('listId2')?.toString().trim() || null;
		const listName2 = fd.get('listName2')?.toString().trim() || null;

		const set: Record<string, unknown> = { bringEmail: email, bringListId: listId, bringListName: listName, bringListId2: listId2, bringListName2: listName2 };
		// Blank password field = keep the existing one; only overwrite when something was typed.
		if (password) set.bringPasswordEnc = await encryptSecret(password);

		await db.update(families).set(set).where(eq(families.id, locals.user.familyId));
		return { savedBring: true };
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const currentPassword = fd.get('currentPassword')?.toString() ?? '';
		const newPassword = fd.get('newPassword')?.toString() ?? '';
		const confirm = fd.get('confirm')?.toString() ?? '';

		if (newPassword.length < 8) return fail(400, { message: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
		if (newPassword !== confirm) return fail(400, { message: 'Neue Passwörter stimmen nicht überein.' });

		try {
			await auth.api.changePassword({
				headers: request.headers,
				body: { currentPassword, newPassword }
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: 'Aktuelles Passwort ist falsch.' });
			return fail(500, { message: 'Unerwarteter Fehler.' });
		}

		return { savedPassword: true };
	},

	// Logs into Bring! with the given (or, if left blank, the already-saved) credentials
	// and lists the account's lists with their IDs — so you don't have to dig through
	// browser dev tools to find a list UUID.
	lookupBringLists: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const emailInput = fd.get('email')?.toString().trim();
		const passwordInput = fd.get('password')?.toString().trim();

		const [family] = await db.select().from(families).where(eq(families.id, locals.user.familyId)).limit(1);
		const email = emailInput || family?.bringEmail || '';
		const password = passwordInput || (family?.bringPasswordEnc ? await decryptSecret(family.bringPasswordEnc) : '');

		if (!email || !password) return fail(400, { message: 'Bring! E-Mail und Passwort eingeben (oben ausfüllen oder vorher speichern).' });

		try {
			const bring = new BringApi({ mail: email, password });
			await bring.login();
			const { lists } = await bring.loadLists();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return { bringListsFound: (lists as any[]).map((l) => ({ id: l.listUuid, name: l.name })) };
		} catch {
			return fail(500, { message: 'Anmeldung bei Bring! fehlgeschlagen. E-Mail/Passwort prüfen.' });
		}
	},

	saveBioabo: async ({ request, locals }) => {
		if (!locals.user) return fail(401);

		const fd = await request.formData();
		const email = fd.get('email')?.toString().trim() || null;
		const password = fd.get('password')?.toString().trim();

		const set: Record<string, unknown> = { bioaboEmail: email };
		if (password) set.bioaboPasswordEnc = await encryptSecret(password);

		await db.update(families).set(set).where(eq(families.id, locals.user.familyId));
		return { savedBioabo: true };
	}
};
