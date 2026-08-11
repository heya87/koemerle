import {
	pgTable,
	pgEnum,
	serial,
	text,
	timestamp,
	date,
	boolean,
	integer,
	unique,
	index
} from 'drizzle-orm/pg-core';
import { families } from './family.schema';

export const cronOutcomeEnum = pgEnum('cron_outcome', ['imported', 'already_done', 'no_delivery', 'error']);

export * from './family.schema';
export * from './auth.schema';

export const recipes = pgTable('recipes', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	ingredients: text('ingredients').notNull(),
	matchKeys: text('match_keys').array().notNull().default([]),
	recipeUrl: text('recipe_url'),
	servings: integer('servings'),
	course: text('course'), // null = both, 'main' = Hauptgang only, 'side' = Beilage only
	kcal: integer('kcal'),
	fatG: integer('fat_g'),
	carbsG: integer('carbs_g'),
	proteinG: integer('protein_g'),
	preparation: text('preparation'),
	transient: boolean('transient').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => [index('recipes_familyId_idx').on(t.familyId)]);

export const basketItems = pgTable('basket_items', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	weekStart: date('week_start').notNull(),
	displayText: text('display_text').notNull(),
	matchKey: text('match_key').notNull(),
	permanent: boolean('permanent').notNull().default(false),
	deliveryDate: date('delivery_date'),
	// True for items typed in by hand (vs. imported by the Gemüsekorb sync).
	// Keeps them safe from the sync's delete-and-reinsert, independently of deliveryDate.
	manual: boolean('manual').notNull().default(false)
}, (t) => [index('basket_items_familyId_idx').on(t.familyId)]);

export const mealPlanEntries = pgTable(
	'meal_plan_entries',
	{
		id: serial('id').primaryKey(),
		familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
		date: date('date').notNull(),
		slot: text('slot').notNull(),
		course: text('course').notNull().default('main'),
		recipeId: integer('recipe_id').references(() => recipes.id),
		freeText: text('free_text'),
		updatedBy: text('updated_by').notNull(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [
		unique().on(t.familyId, t.date, t.slot, t.course),
		index('meal_plan_entries_familyId_idx').on(t.familyId)
	]
);

// One row per family — tracks that family's active planning period
export const planMeta = pgTable('plan_meta', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().unique().references(() => families.id, { onDelete: 'cascade' }),
	planStart: date('plan_start').notNull(),
	planEnd: date('plan_end').notNull(),
	planningStartSlot: text('planning_start_slot')
});

export const activityLog = pgTable('activity_log', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	logDate: date('log_date').notNull(),
	userId: text('user_id').notNull(),
	message: text('message').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => [index('activity_log_familyId_idx').on(t.familyId)]);

// Equivalence groups for ingredient matching.
// Shared across all families on purpose — generic German ingredient synonyms, not
// private household data. Any family can tune this via Settings; visible to everyone.
export const ingredientGroups = pgTable('ingredient_groups', {
	id: serial('id').primaryKey(),
	label: text('label').notNull().unique(),
	matchKeys: text('match_keys').array().notNull().default([])
});

export const lagerItems = pgTable('lager_items', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	displayText: text('display_text').notNull(),
	matchKey: text('match_key').notNull()
}, (t) => [index('lager_items_familyId_idx').on(t.familyId)]);

// Ingredient match keys that count toward the 30-plants-per-week goal.
// Shared across all families, same reasoning as ingredientGroups above.
export const plantFoods = pgTable('plant_foods', {
	id: serial('id').primaryKey(),
	matchKey: text('match_key').notNull().unique(),
	label: text('label').notNull()
});

export const cronRuns = pgTable('cron_runs', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	job: text('job').notNull(),
	ranAt: timestamp('ran_at').notNull().defaultNow(),
	success: boolean('success').notNull(),
	outcome: cronOutcomeEnum('outcome').notNull(),
	detail: text('detail')
}, (t) => [index('cron_runs_familyId_idx').on(t.familyId)]);

export const shoppingSessions = pgTable('shopping_sessions', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	planStart: date('plan_start').notNull(),
	planEnd: date('plan_end').notNull(),
	sentAt: timestamp('sent_at')
}, (t) => [index('shopping_sessions_familyId_idx').on(t.familyId)]);

export const shoppingItems = pgTable('shopping_items', {
	id: serial('id').primaryKey(),
	// Duplicated from the parent session's familyId on purpose — defense in depth, so a
	// query that forgets to join shoppingSessions still can't leak another family's items.
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	sessionId: integer('session_id').notNull().references(() => shoppingSessions.id, { onDelete: 'cascade' }),
	displayText: text('display_text').notNull(),
	matchKey: text('match_key').notNull(),
	excluded: boolean('excluded').notNull().default(false)
}, (t) => [index('shopping_items_familyId_idx').on(t.familyId)]);

// Learned/edited preference for which Bring! list an ingredient goes to.
// listIndex is an index into getBringLists() (0 or 1) — not a raw Bring list id,
// since which env-configured list is which can change per deployment.
export const ingredientListPrefs = pgTable('ingredient_list_prefs', {
	id: serial('id').primaryKey(),
	familyId: integer('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
	matchKey: text('match_key').notNull(),
	listIndex: integer('list_index').notNull().default(0)
}, (t) => [unique().on(t.familyId, t.matchKey)]);
