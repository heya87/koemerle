/**
 * Local dev bootstrap: creates one family (if none exists yet) and the two app users
 * as members of it, first one as admin. Safe to re-run — skips users that already exist.
 * Usage: npx tsx src/lib/server/seed.ts
 */
import { generateId } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './db/schema';
import { user as userTable, account as accountTable, families as familiesTable } from './db/schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const users = [
	{ name: 'Joël', email: process.env.USER1_EMAIL, password: process.env.USER1_PASSWORD },
	{ name: 'Freundin', email: process.env.USER2_EMAIL, password: process.env.USER2_PASSWORD }
].filter((u) => u.email && u.password) as { name: string; email: string; password: string }[];

if (users.length === 0) {
	console.error('Set at least USER1_EMAIL and USER1_PASSWORD env vars');
	process.exit(1);
}

let [family] = await db.select().from(familiesTable).limit(1);
if (!family) {
	[family] = await db.insert(familiesTable).values({ name: process.env.FAMILY_NAME || 'Dev-Familie', claudeEnabled: true }).returning();
	console.log(`Created family: ${family.name}`);
}

for (const [i, u] of users.entries()) {
	const existing = await db.select().from(userTable).where(eq(userTable.email, u.email)).limit(1);
	if (existing.length > 0) {
		console.log(`User already exists, skipping: ${u.email}`);
		continue;
	}

	const id = generateId();
	await db.insert(userTable).values({ id, name: u.name, email: u.email, familyId: family.id, isAdmin: i === 0 });
	await db.insert(accountTable).values({
		id: generateId(),
		accountId: u.email,
		providerId: 'credential',
		userId: id,
		password: await hashPassword(u.password)
	});
	console.log(`Created user: ${u.email}${i === 0 ? ' (admin)' : ''}`);
}

await client.end();
