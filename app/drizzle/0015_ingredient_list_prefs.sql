CREATE TABLE ingredient_list_prefs (
    id SERIAL PRIMARY KEY,
    match_key TEXT NOT NULL UNIQUE,
    list_index INTEGER NOT NULL DEFAULT 0
);
