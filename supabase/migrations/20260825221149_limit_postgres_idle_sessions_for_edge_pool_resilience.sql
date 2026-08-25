-- Prevent idle direct postgres.js Edge pools from exhausting the small production connection budget.
-- Active queries and transactions are unaffected; idle sessions reconnect on demand.
alter role postgres set idle_session_timeout = '15s';
