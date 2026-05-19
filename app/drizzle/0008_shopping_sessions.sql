CREATE TABLE shopping_sessions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    plan_start DATE NOT NULL,
    plan_end DATE NOT NULL,
    sent_at TIMESTAMP
);

CREATE TABLE shopping_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES shopping_sessions(id) ON DELETE CASCADE,
    display_text TEXT NOT NULL,
    match_key TEXT NOT NULL,
    excluded BOOLEAN NOT NULL DEFAULT FALSE
);
