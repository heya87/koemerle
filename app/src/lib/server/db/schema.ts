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

// One row per week — tracks planning state for that week
export const weekMeta = pgTable('week_meta', {
	weekStart: date('week_start').primaryKey(),
	planningStartDay: text('planning_start_day'), // e.g. 'monday', null until planning is started
	planningStartSlot: text('planning_start_slot') // e.g. 'lunch' or 'dinner', null until planning is started
});

export const activityLog = pgTable('activity_log', {
	id: serial('id').primaryKey(),
	weekStart: date('week_start').notNull(),
	userId: text('user_id').notNull(),
	message: text('message').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Equivalence groups for ingredient matching.
// All keys in a group are treated as the same ingredient.
// First key is the canonical form — all others normalize to it.
// e.g. matchKeys: ['rüebli', 'rüben', 'karotte']
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

