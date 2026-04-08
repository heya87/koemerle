--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD COLUMN "date" date;
--> statement-breakpoint
UPDATE "meal_plan_entries" SET "date" = "week_start"::date + CASE
  WHEN "day" = 'monday'    THEN 0
  WHEN "day" = 'tuesday'   THEN 1
  WHEN "day" = 'wednesday' THEN 2
  WHEN "day" = 'thursday'  THEN 3
  WHEN "day" = 'friday'    THEN 4
  WHEN "day" = 'saturday'  THEN 5
  WHEN "day" = 'sunday'    THEN 6
  ELSE 0
END;
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ALTER COLUMN "date" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" DROP CONSTRAINT "meal_plan_entries_week_start_day_slot_course_unique";
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" DROP COLUMN "week_start";
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" DROP COLUMN "day";
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_date_slot_course_unique" UNIQUE("date","slot","course");
--> statement-breakpoint
DROP TABLE "week_meta";
--> statement-breakpoint
CREATE TABLE "plan_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_start" date NOT NULL,
	"plan_end" date NOT NULL,
	"planning_start_slot" text
);
--> statement-breakpoint
ALTER TABLE "activity_log" RENAME COLUMN "week_start" TO "log_date";
