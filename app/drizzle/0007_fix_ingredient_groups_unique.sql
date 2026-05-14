-- Remove duplicate ingredient groups, keeping lowest id per label
DELETE FROM ingredient_groups
WHERE id NOT IN (
    SELECT MIN(id) FROM ingredient_groups GROUP BY label
);

--> statement-breakpoint
ALTER TABLE ingredient_groups ADD CONSTRAINT ingredient_groups_label_unique UNIQUE (label);
