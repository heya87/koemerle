import { generateId } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { families, user, account, signupTokens, type Family } from '$lib/server/db/schema';
import { encryptSecret, decryptSecret } from '$lib/server/crypto';

const SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createFamily(name: string) {
	const [family] = await db.insert(families).values({ name }).returning();
	return family;
}

/**
 * Creates a login with no password yet — it can't be used to sign in until the
 * recipient completes /set-password/<token>. Call issueSetupToken() right after to
 * get the link to send them.
 */
export async function createFamilyMember(params: { familyId: number; name: string; email: string; isAdmin?: boolean }) {
	const id = generateId();
	await db.insert(user).values({
		id,
		name: params.name,
		email: params.email,
		familyId: params.familyId,
		isAdmin: params.isAdmin ?? false
	});
	await db.insert(account).values({
		id: generateId(),
		accountId: params.email,
		providerId: 'credential',
		userId: id,
		password: null
	});
	return id;
}

/** Invalidates any outstanding unused links for this user, then issues a fresh one. */
export async function issueSetupToken(userId: string): Promise<string> {
	await db
		.update(signupTokens)
		.set({ usedAt: new Date() })
		.where(and(eq(signupTokens.userId, userId), isNull(signupTokens.usedAt)));

	const token = generateId(32);
	await db.insert(signupTokens).values({
		token,
		userId,
		expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS)
	});
	return token;
}

export async function validateSetupToken(token: string) {
	const [row] = await db.select().from(signupTokens).where(eq(signupTokens.token, token)).limit(1);
	if (!row) return { valid: false as const, reason: 'not_found' as const };
	if (row.usedAt) return { valid: false as const, reason: 'used' as const };
	if (row.expiresAt < new Date()) return { valid: false as const, reason: 'expired' as const };
	return { valid: true as const, userId: row.userId, tokenId: row.id };
}

export async function completeSetupToken(tokenId: number, userId: string, newPassword: string) {
	const hashed = await hashPassword(newPassword);
	await db.update(account).set({ password: hashed }).where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
	await db.update(signupTokens).set({ usedAt: new Date() }).where(eq(signupTokens.id, tokenId));
}

export type BringConfig = { email: string; password: string; lists: { id: string; name: string }[] } | null;
export type BioaboConfig = { email: string; password: string } | null;

// Family 1 is the household that ran on env vars before per-family credentials existed
// (see drizzle/0017_families.sql). Its env fallback only applies to that one family —
// falling back for any other family would leak family 1's own credentials to them.
const LEGACY_ENV_FALLBACK_FAMILY_ID = 1;

export async function getFamilyBringConfig(family: Family, envFallback: { email?: string; password?: string; listId?: string; listName?: string; listId2?: string; listName2?: string }): Promise<BringConfig> {
	if (family.bringEmail && family.bringPasswordEnc && family.bringListId) {
		const lists = [{ id: family.bringListId, name: family.bringListName || 'Liste 1' }];
		if (family.bringListId2) lists.push({ id: family.bringListId2, name: family.bringListName2 || 'Liste 2' });
		const password = await decryptSecret(family.bringPasswordEnc);
		return { email: family.bringEmail, password, lists };
	}
	if (family.id === LEGACY_ENV_FALLBACK_FAMILY_ID && envFallback.email && envFallback.password && envFallback.listId) {
		const lists = [{ id: envFallback.listId, name: envFallback.listName || 'Liste 1' }];
		if (envFallback.listId2) lists.push({ id: envFallback.listId2, name: envFallback.listName2 || 'Liste 2' });
		return { email: envFallback.email, password: envFallback.password, lists };
	}
	return null;
}

export async function getFamilyBioaboConfig(family: Family, envFallback: { email?: string; password?: string }): Promise<BioaboConfig> {
	if (family.bioaboEmail && family.bioaboPasswordEnc) {
		const password = await decryptSecret(family.bioaboPasswordEnc);
		return { email: family.bioaboEmail, password };
	}
	if (family.id === LEGACY_ENV_FALLBACK_FAMILY_ID && envFallback.email && envFallback.password) {
		return { email: envFallback.email, password: envFallback.password };
	}
	return null;
}

export async function getFamily(familyId: number): Promise<Family | null> {
	const [row] = await db.select().from(families).where(eq(families.id, familyId)).limit(1);
	return row ?? null;
}

export async function getAllFamilies(): Promise<Family[]> {
	return db.select().from(families).orderBy(families.name);
}
