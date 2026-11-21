CREATE TABLE tips (
 id TEXT PRIMARY KEY,
 room TEXT NOT NULL,
 cents INTEGER NOT NULL CHECK(cents BETWEEN 100 AND 50000),
 mode TEXT NOT NULL,
 created INTEGER NOT NULL,
 status TEXT NOT NULL,
 intent TEXT
);
--> statement-breakpoint
CREATE INDEX tips_period ON tips(created,room);
--> statement-breakpoint
CREATE TABLE reports (
 period_start TEXT PRIMARY KEY,
 period_end_exclusive TEXT NOT NULL,
 generated_at INTEGER NOT NULL,
 summary_json TEXT NOT NULL
);
