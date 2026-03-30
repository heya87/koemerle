/**
 * Creates the two app users. Run once during setup.
 * Usage: npx tsx src/lib/server/seed.ts
 */
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true }
});

const users = [
	{ name: 'Joël', email: process.env.USER1_EMAIL, password: process.env.USER1_PASSWORD },
	{ name: 'Freundin', email: process.env.USER2_EMAIL, password: process.env.USER2_PASSWORD }
].filter((u) => u.email && u.password) as { name: string; email: string; password: string }[];

if (users.length === 0) {
	console.error('Set at least USER1_EMAIL and USER1_PASSWORD env vars');
	process.exit(1);
}

for (const user of users) {
	const result = await auth.api.signUpEmail({ body: user });
	if (result.user) {
		console.log(`Created user: ${user.email}`);
	} else {
		console.log(`User already exists, skipping: ${user.email}`);
	}
}

await client.end();
