import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { families, user, cronRuns } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createFamily, createFamilyMember, issueSetupToken } from '$lib/server/families';

export const load: PageServerLoad = async ({ locals }) => {
	const [allFamilies, allUsers, cronRunRows] = await Promise.all([
		db.select().from(families).orderBy(families.name),
		db.select().from(user).orderBy(user.name),
		db.select().from(cronRuns).orderBy(desc(cronRuns.ranAt)).limit(100)
	]);

	const membersByFamily = new Map<number, typeof allUsers>();
	for (const u of allUsers) {
		const list = membersByFamily.get(u.familyId) ?? [];
		list.push(u);
		membersByFamily.set(u.familyId, list);
	}

	const familyNameById = new Map(allFamilies.map((f) => [f.id, f.name]));
	const cronRunsWithFamily = cronRunRows.map((r) => ({ ...r, familyName: familyNameById.get(r.familyId) ?? '?' }));

	return {
		families: allFamilies.map((f) => ({ ...f, members: membersByFamily.get(f.id) ?? [] })),
		cronRuns: cronRunsWithFamily,
		currentFamilyId: locals.user!.familyId
	};
};

export const actions: Actions = {
	createFamily: async ({ request, url }) => {
		const fd = await request.formData();
		const familyName = fd.get('familyName')?.toString().trim() ?? '';
		const memberName = fd.get('memberName')?.toString().trim() ?? '';
		const email = fd.get('email')?.toString().trim().toLowerCase() ?? '';

		if (!familyName || !memberName || !email) return fail(400, { message: 'Alle Felder sind erforderlich.' });

		const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
		if (existing.length > 0) return fail(400, { message: 'Diese E-Mail wird bereits verwendet.' });

		const family = await createFamily(familyName);
		const userId = await createFamilyMember({ familyId: family.id, name: memberName, email });
		const token = await issueSetupToken(userId);

		return { link: `${url.origin}/set-password/${token}`, forName: memberName };
	},

	addMember: async ({ request, url }) => {
		const fd = await request.formData();
		const familyId = Number(fd.get('familyId'));
		const memberName = fd.get('memberName')?.toString().trim() ?? '';
		const email = fd.get('email')?.toString().trim().toLowerCase() ?? '';

		if (!familyId || !memberName || !email) return fail(400, { message: 'Alle Felder sind erforderlich.' });

		const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
		if (existing.length > 0) return fail(400, { message: 'Diese E-Mail wird bereits verwendet.' });

		const userId = await createFamilyMember({ familyId, name: memberName, email });
		const token = await issueSetupToken(userId);

		return { link: `${url.origin}/set-password/${token}`, forName: memberName };
	},

	resetLink: async ({ request, url }) => {
		const fd = await request.formData();
		const userId = fd.get('userId')?.toString() ?? '';
		if (!userId) return fail(400);

		const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
		if (!target) return fail(404);

		const token = await issueSetupToken(userId);
		return { link: `${url.origin}/set-password/${token}`, forName: target.name };
	},

	// Cascades to everything the family owns (users + their sessions/logins, recipes,
	// basket, plan, shopping, activity log — see the ON DELETE cascade FKs in
	// drizzle/0017_families.sql). Irreversible, so it requires typing the exact family
	// name as an extra confirmation, re-checked here server-side too.
	deleteFamily: async ({ request, locals }) => {
		const fd = await request.formData();
		const familyId = Number(fd.get('familyId'));
		const confirmName = fd.get('confirmName')?.toString().trim() ?? '';
		if (!familyId) return fail(400);

		if (locals.user?.familyId === familyId) {
			return fail(400, { message: 'Du kannst deine eigene Familie nicht löschen.' });
		}

		const [target] = await db.select().from(families).where(eq(families.id, familyId)).limit(1);
		if (!target) return fail(404);
		if (confirmName !== target.name) {
			return fail(400, { message: 'Eingegebener Name stimmt nicht überein — nichts gelöscht.' });
		}

		await db.delete(families).where(eq(families.id, familyId));
		return { deletedFamily: target.name };
	},

	toggleClaude: async ({ request }) => {
		const fd = await request.formData();
		const familyId = Number(fd.get('familyId'));
		const enabled = fd.get('enabled') === 'true';
		if (!familyId) return fail(400);

		await db.update(families).set({ claudeEnabled: enabled }).where(eq(families.id, familyId));
	}
};
