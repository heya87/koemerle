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
	servings: integer('servings'),
	course: text('course'), // null = both, 'main' = Hauptgang only, 'side' = Beilage only
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
		date: date('date').notNull(),
		slot: text('slot').notNull(),
		course: text('course').notNull().default('main'),
		recipeId: integer('recipe_id').references(() => recipes.id),
		freeText: text('free_text'),
		updatedBy: text('updated_by').notNull(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [unique().on(t.date, t.slot, t.course)]
);

// One row — tracks the active planning period
export const planMeta = pgTable('plan_meta', {
	id: serial('id').primaryKey(),
	planStart: date('plan_start').notNull(),
	planEnd: date('plan_end').notNull(),
	planningStartSlot: text('planning_start_slot')
});

export const activityLog = pgTable('activity_log', {
	id: serial('id').primaryKey(),
	logDate: date('log_date').notNull(),
	userId: text('user_id').notNull(),
	message: text('message').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Equivalence groups for ingredient matching.
export const ingredientGroups = pgTable('ingredient_groups', {
	id: serial('id').primaryKey(),
	label: text('label').notNull(),
	matchKeys: text('match_keys').array().notNull().default([])
});

// Ingredient match keys that count toward the 30-plants-per-week goal.
export const plantFoods = pgTable('plant_foods', {
	id: serial('id').primaryKey(),
	matchKey: text('match_key').notNull().unique(),
	label: text('label').notNull()
});
