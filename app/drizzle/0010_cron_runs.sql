CREATE TYPE cron_outcome AS ENUM ('imported', 'already_done', 'no_delivery', 'error');

CREATE TABLE cron_runs (
    id SERIAL PRIMARY KEY,
    job TEXT NOT NULL,
    ran_at TIMESTAMP NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    outcome cron_outcome NOT NULL,
    detail TEXT
);
