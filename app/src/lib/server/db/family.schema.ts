import { pgTable, serial, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core';

// One row per household. The tenant boundary for all per-family data (recipes, basket,
// meal plan, shopping, activity log, lager) plus each family's own Bring!/Biogmüsabo
// integration credentials. Secrets (*_password_enc) are stored encrypted — see
// $lib/server/crypto.ts — never in plain text.
export const families = pgTable('families', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	bringEmail: text('bring_email'),
	bringPasswordEnc: text('bring_password_enc'),
	bringListId: text('bring_list_id'),
	bringListName: text('bring_list_name'),
	bringListId2: text('bring_list_id_2'),
	bringListName2: text('bring_list_name_2'),
	bioaboEmail: text('bioabo_email'),
	bioaboPasswordEnc: text('bioabo_password_enc'),
	// Claude meal suggestions cost API credits on a shared key — off by default,
	// only an admin can turn it on per family (see /admin).
	claudeEnabled: boolean('claude_enabled').notNull().default(false),
	// Null = use DEFAULT_CLAUDE_PROMPT (src/lib/server/claude.ts). Each family can
	// customize it from that same starting point via Settings → Claude.
	claudePromptTemplate: text('claude_prompt_template'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export type Family = typeof families.$inferSelect;

// One-time links for setting/resetting a password without an email service.
// An admin creates one in /admin and sends the URL manually (WhatsApp/Signal/etc.);
// the recipient visits /set-password/<token> once to set their own password.
export const signupTokens = pgTable(
	'signup_tokens',
	{
		id: serial('id').primaryKey(),
		token: text('token').notNull().unique(),
		// No .references() here on purpose — importing `user` from ./auth.schema (which
		// already imports `families` from this file) would be circular. The real FK +
		// ON DELETE cascade lives in drizzle/0017_families.sql and is enforced by Postgres.
		userId: text('user_id').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		usedAt: timestamp('used_at'),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => [index('signup_tokens_userId_idx').on(t.userId)]
);
