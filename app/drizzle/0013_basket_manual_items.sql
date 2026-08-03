ALTER TABLE basket_items ADD COLUMN manual boolean NOT NULL DEFAULT false;
UPDATE basket_items SET manual = true WHERE delivery_date IS NULL;
