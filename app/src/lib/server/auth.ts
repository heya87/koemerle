import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	// No public registration — accounts are created by an admin in /admin and activated
	// via a one-time /set-password link (see $lib/server/families.ts).
	emailAndPassword: { enabled: true, disableSignUp: true },
	user: {
		additionalFields: {
			familyId: { type: 'number', required: true, input: false },
			isAdmin: { type: 'boolean', defaultValue: false, input: false }
		}
	},
	plugins: [sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
});
