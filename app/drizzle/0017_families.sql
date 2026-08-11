-- Multi-family support.
-- Existing data (2 users, all recipes/basket/plan/shopping/etc.) becomes "family 1" — zero data loss.

CREATE TABLE "families" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bring_email" text,
	"bring_password_enc" text,
	"bring_list_id" text,
	"bring_list_name" text,
	"bring_list_id_2" text,
	"bring_list_name_2" text,
	"bioabo_email" text,
	"bioabo_password_enc" text,
	"claude_enabled" boolean DEFAULT false NOT NULL,
	"claude_prompt_template" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "signup_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signup_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "signup_tokens" ADD CONSTRAINT "signup_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "signup_tokens_userId_idx" ON "signup_tokens" USING btree ("user_id");
--> statement-breakpoint

-- The one existing household becomes family 1. Rename it later in Settings if you like.
-- claude_enabled = true here only, so today's Claude-suggestion behavior doesn't change;
-- every other (future) family starts with it off and only an admin can turn it on.
INSERT INTO "families" ("name", "claude_enabled") VALUES ('Unsere Familie', true);
--> statement-breakpoint

-- ── user: family membership + platform-admin flag ──
ALTER TABLE "user" ADD COLUMN "family_id" integer;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "user" SET "family_id" = 1;
--> statement-breakpoint
-- Both existing accounts become admins so at least one working login can reach /admin.
-- Demote the one that shouldn't manage other families later with a single UPDATE if desired.
UPDATE "user" SET "is_admin" = true;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_familyId_idx" ON "user" USING btree ("family_id");
--> statement-breakpoint

-- ── domain tables: add family_id, backfill to family 1, enforce NOT NULL + FK ──

ALTER TABLE "recipes" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "recipes" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recipes_familyId_idx" ON "recipes" USING btree ("family_id");
--> statement-breakpoint

ALTER TABLE "basket_items" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "basket_items" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "basket_items" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "basket_items_familyId_idx" ON "basket_items" USING btree ("family_id");
--> statement-breakpoint

ALTER TABLE "meal_plan_entries" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "meal_plan_entries" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "meal_plan_entries_familyId_idx" ON "meal_plan_entries" USING btree ("family_id");
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" DROP CONSTRAINT IF EXISTS "meal_plan_entries_date_slot_course_unique";
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_family_date_slot_course_unique" UNIQUE("family_id","date","slot","course");
--> statement-breakpoint

ALTER TABLE "plan_meta" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "plan_meta" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "plan_meta" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "plan_meta" ADD CONSTRAINT "plan_meta_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plan_meta" ADD CONSTRAINT "plan_meta_family_id_unique" UNIQUE("family_id");
--> statement-breakpoint

ALTER TABLE "activity_log" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "activity_log" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "activity_log" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "activity_log_familyId_idx" ON "activity_log" USING btree ("family_id");
--> statement-breakpoint

ALTER TABLE "lager_items" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "lager_items" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "lager_items" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "lager_items" ADD CONSTRAINT "lager_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lager_items_familyId_idx" ON "lager_items" USING btree ("family_id");
--> statement-breakpoint

ALTER TABLE "cron_runs" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "cron_runs" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "cron_runs" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "cron_runs" ADD CONSTRAINT "cron_runs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cron_runs_familyId_idx" ON "cron_runs" USING btree ("family_id");
--> statement-breakpoint

ALTER TABLE "shopping_sessions" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "shopping_sessions" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "shopping_sessions" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shopping_sessions" ADD CONSTRAINT "shopping_sessions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shopping_sessions_familyId_idx" ON "shopping_sessions" USING btree ("family_id");
--> statement-breakpoint

-- shopping_items is scoped indirectly via session_id → shopping_sessions.family_id,
-- but family_id is duplicated here too as defense in depth (so a query that forgets
-- to join sessions still can't leak another family's items).
ALTER TABLE "shopping_items" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "shopping_items" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "shopping_items" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shopping_items_familyId_idx" ON "shopping_items" USING btree ("family_id");
--> statement-breakpoint

ALTER TABLE "ingredient_list_prefs" ADD COLUMN "family_id" integer;
--> statement-breakpoint
UPDATE "ingredient_list_prefs" SET "family_id" = 1;
--> statement-breakpoint
ALTER TABLE "ingredient_list_prefs" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ingredient_list_prefs" ADD CONSTRAINT "ingredient_list_prefs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ingredient_list_prefs" DROP CONSTRAINT IF EXISTS "ingredient_list_prefs_match_key_key";
--> statement-breakpoint
ALTER TABLE "ingredient_list_prefs" DROP CONSTRAINT IF EXISTS "ingredient_list_prefs_match_key_unique";
--> statement-breakpoint
ALTER TABLE "ingredient_list_prefs" ADD CONSTRAINT "ingredient_list_prefs_family_match_key_unique" UNIQUE("family_id","match_key");
--> statement-breakpoint

-- Note: ingredient_groups and plant_foods stay global/shared across all families on
-- purpose — generic German ingredient-matching reference data, not private household
-- data. Any family can tune them via Settings and the change is visible to everyone.
-- Revisit if that turns out to be unwanted.

-- The Claude prompt template moves from the single global site_settings row to a
-- per-family column — carry over whatever family 1 already had customized (if
-- anything), then drop the now-empty table. NULL just means "use DEFAULT_CLAUDE_PROMPT",
-- same fallback behavior as before, so every other (future) family starts on today's
-- default text too.
UPDATE "families" SET "claude_prompt_template" = (SELECT "claude_prompt_template" FROM "site_settings" LIMIT 1) WHERE "id" = 1;
--> statement-breakpoint
DROP TABLE IF EXISTS "site_settings";
