/**
 * Open one connection and run SELECT 1 so Neon wakes before you use the app.
 * Usage: from `web/` run `npm run db:wake`
 */
require("dotenv").config();

const pg = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to web/.env");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 120_000,
  max: 1,
});

pool
  .query("SELECT 1 AS ok")
  .then((res) => {
    console.log("Database OK:", res.rows[0]);
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
