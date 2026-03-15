import {
	pgTable,
	serial,
	text,
	timestamp,
	date,
	boolean,
	integer,
	unique
} from 'drizzle-orm/pg-core';

export * from './auth.schema';

export const recipes = pgTable('recipes', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	ingredients: text('ingredients').notNull(),
	matchKeys: text('match_keys').array().notNull().default([]),
	recipeUrl: text('recipe_url'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const basketItems = pgTable('basket_items', {
	id: serial('id').primaryKey(),
	weekStart: date('week_start').notNull(),
	displayText: text('display_text').notNull(),
	matchKey: text('match_key').notNull(),
	permanent: boolean('permanent').notNull().default(false)
});

export const mealPlanEntries = pgTable(
	'meal_plan_entries',
	{
		id: serial('id').primaryKey(),
		weekStart: date('week_start').notNull(),
		day: text('day').notNull(),
		slot: text('slot').notNull(),
		recipeId: integer('recipe_id').references(() => recipes.id),
		freeText: text('free_text'),
		updatedBy: text('updated_by').notNull(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [unique().on(t.weekStart, t.day, t.slot)]
);

export const activityLog = pgTable('activity_log', {
	id: serial('id').primaryKey(),
	weekStart: date('week_start').notNull(),
	userId: text('user_id').notNull(),
	message: text('message').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
