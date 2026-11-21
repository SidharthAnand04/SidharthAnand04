# Roomkind
Room QR cards, guest tips, and housekeeping department reports for a single hotel. USD. Room numbers can include a trailing letter. The hotel can cross-reference the room and tip time with its housekeeping roster. The application does not issue payroll payouts.

## Run and verify
Node 24 or newer. Run `npm test` for SQLite-backed HTTP route tests and the build. The Worker entrypoint is dist/server/index.js. Bind a D1 database as DB and apply drizzle/0000_tips.sql before serving. The build bundles the QR encoder locally.

## Hotel operations
Use /cards to enter the room list and print the cards. Every QR code points to the matching /r/ROOM on the current domain. Public receipt URLs use random bearer identifiers. The public API never serves department reports.

The default mode records simulated tips. For a single hotel approved for Plaid Transfer, configure PLAID_ENV (sandbox or production), PLAID_CLIENT_ID, PLAID_SECRET, PLAID_FUNDING_ACCOUNT_ID (the hotel's verified account), and PLAID_LINK_CUSTOMIZATION (single-account selection). Plaid Link handles bank credentials and authorization. Validate authorization, settlement, returns and retries with the hotel's sandbox before production. A receipt refresh retrieves current status from Plaid. Sandbox and demo totals are isolated by mode. Money received by the hotel still requires allocation to staff.

## Fortnight close
The linked reporting task runs every second Monday. Periods run from Monday 00:00 UTC to Monday 00:00 UTC 14 days later, anchored on November 16, 2026. Before snapshotting, reconcile bank entries for the closed period through their receipt endpoints. POST /api/reports/close computes the latest closed period and atomically upserts one row per period, including empty periods. Its response exposes only dates. The configured REPORT_OWNER_EMAIL can sign in at /reports for the current totals, report archive and CSV export. The linked task can read the reports table through authenticated Sites database tools. Reports are as-of snapshots of tips initiated in that period. Later returns require a separate payroll adjustment. The task provides the summary privately to the owner.

## Vercel production
The Vercel Node function serves guest checkout, QR encoding, receipts, Plaid requests, reporting and CSV downloads. The durable D1 ledger also serves the existing installation and is reached through authenticated named operations. Production secrets are LEDGER_SECRET, CRON_SECRET and REPORT_PASSWORD. Sign in to /reports with username manager and the project's REPORT_PASSWORD. Every Monday the authenticated cron reconciles the latest closed fortnight and updates its snapshot idempotently; only one report is created per 14-day period. The private report notification runs every second Monday. The Plaid variables above belong in the Vercel production environment for payments on the Vercel domain.
